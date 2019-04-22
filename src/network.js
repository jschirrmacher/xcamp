'use strict'

module.exports = (dgraphClient, dgraph, Person, Topic, store, readModels) => {
  function rebuild() {
    async function dropAll(dgraphClient) {
      const op = new dgraph.Operation()
      op.setDropAll(true)
      await dgraphClient.alter(op)
      store.deleteAll()
    }

    async function setSchema(dgraphClient) {
      const op = new dgraph.Operation()
      op.setSchema(`
        type: string @index(term) .
        access_code: string @index(exact) .
        email: string @index(exact) .
      `)
      await dgraphClient.alter(op)
    }

    const rootTopics = ['Design Thinking', 'Lean Startup', 'User Experience', 'Agile']
    return dropAll(dgraphClient)
      .then(() => setSchema(dgraphClient))
      .then(async () => {
        const txn = dgraphClient.newTxn()
        try {
          const mu = new dgraph.Mutation()
          const data = {
            name: 'XCamp 2019',
            type: 'root',
            image: 'xcamp.png',
            topics: rootTopics.map(name => ({type: 'topic', name}))
          }
          mu.setSetJson(data)
          const assigned = await txn.mutate(mu)
          txn.commit()
          store.add({type: 'root-created', root: {id: assigned.getUidsMap().get('blank-0'), name: data.name, image: data.image}})
          rootTopics.forEach((name, num) => {
            store.add({type: 'topic-created', topic: {id: assigned.getUidsMap().get(`blank-${num + 1}`), name}})
          })
        } finally {
          txn.discard()
        }
      })
  }

  function getTickets(user) {
    if (user && user.type === 'ticket') {
      return user.uid
    } else if (user && user.type === 'customer' && user.invoices) {
      return user.invoices["0"].tickets.map(ticket => ticket.uid)
    }
    return []
  }

  async function getAllTickets(txn) {
    const tickets = {}
    const data = await txn.query(`{ all(func: eq(type, "invoice"))
     { payment paid customer {firm} tickets { participant { uid firstName lastName email}}}}`)
    await Promise.all(data.getJson().all.map(async invoice => {
      if (invoice.payment !== 'paypal' || invoice.paid) {
        await Promise.all(invoice.tickets.map(async ticket => {
          ticket.firm = (invoice.customer && invoice.customer[0].firm) || ''
          tickets[ticket.participant[0].uid] = ticket
        }))
      }
    }))
    return Object.values(tickets)
  }

  async function getGraph(what = 'participants', user = null) {
    async function handleTopic(txn, topic, backlinkId, backlinkType) {
      const found = nodes.find(node => node.id === topic.uid)
      if (!found) {
        const newNode = await Topic.get(txn, topic.uid)
        newNode.editable = !!user
        newNode.type = 'topic'
        newNode.links = {}
        if (backlinkId && backlinkType) {
          newNode.links[backlinkType] = [backlinkId]
        }
        nodes.push(newNode)
        return topic.uid
      } else {
        if (backlinkId && backlinkType) {
          found.links[backlinkType] = (found.links[backlinkType] || []).concat(backlinkId)
        }
        return found.id
      }
    }

    const txn = dgraphClient.newTxn()
    const nodes = []
    try {
      const rootAttributes = {type: 'root', shape: 'circle', open: true, editable: user && user.isAdmin}
      const base = await txn.query('{ all(func: eq(type, "root")) {id: uid name description url image topics {uid name}}}')
      const xcamp = Object.assign(base.getJson().all[0], rootAttributes)
      xcamp.links = {topics: xcamp.topics && await Promise.all(xcamp.topics.map(topic => handleTopic(txn, topic)))}
      delete xcamp.topics
      nodes.push(xcamp)

      const myUID = user && (user.type === 'customer' ? user.person[0].uid : user.uid)
      const myTickets = getTickets(user)
      const tickets = await getAllTickets(txn)
      await Promise.all(tickets.map(async ticket => {
        const person = await Person.get(txn, ticket.participant[0].uid)
        nodes.push({
          id: person.uid,
          editable: (user && user.isAdmin) || myTickets.indexOf(ticket.uid) >= 0,
          details: 'network/persons/' + person.uid,
          name: person.firstName + ' ' + person.lastName,
          image: person.image,
          type: 'person',
          access_code: myUID === person.uid ? user.access_code : undefined,
          links: {
            topics: person.topics && await Promise.all(person.topics.map(topic => handleTopic(txn, topic, person.id, 'persons')))
          }
        })
      }))
      return {nodes, myNode: myUID}
    } finally {
      txn.discard()
    }
  }

  function getNodeId(user) {
    return user.type === 'customer' ? user.person[0].uid : user.uid
  }

  return {
    rebuild,
    getGraph,
    getAllTickets,
    getNodeId
  }
}
