'use strict'

module.exports = (dgraphClient, dgraph, Person, Topic) => {
  function rebuild() {
    async function dropAll(dgraphClient) {
      const op = new dgraph.Operation()
      op.setDropAll(true)
      await dgraphClient.alter(op)
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

    return dropAll(dgraphClient)
      .then(() => setSchema(dgraphClient))
      .then(async () => {
        const txn = dgraphClient.newTxn()
        try {
          const mu = new dgraph.Mutation()
          const image = 'xcamp.png'
          mu.setSetJson({
            name: 'XCamp 2018', type: 'root', image, topics: [
              {type: 'topic', name: 'Design Thinking'},
              {type: 'topic', name: 'Lean Startup'},
              {type: 'topic', name: 'User Experience'},
              {type: 'topic', name: 'Agile'}
            ]
          })
          await txn.mutate(mu)
          txn.commit()
        } finally {
          txn.discard()
        }
      })
  }

  function getTickets(user) {
    if (user && user.type === 'ticket') {
      return user.uid
    } else if (user && user.type === 'customer') {
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
    function handleTopic(topic, backlinkId, backlinkType) {
      const found = nodes.find(node => node.id === topic.uid)
      if (!found) {
        const newNode = {id: topic.uid, name: topic.name, type: 'topic', links: {}}
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
      const base = await txn.query('{ all(func: eq(type, "root")) {id: uid name image topics {uid name}}}')
      const xcamp = Object.assign(base.getJson().all[0], {type: 'root', shape: 'circle', open: true})
      xcamp.links = {topics: xcamp.topics && xcamp.topics.map(topic => handleTopic(topic))}
      delete xcamp.topics
      nodes.push(xcamp)

      const myTickets = getTickets(user)
      const tickets = await getAllTickets(txn)
      await Promise.all(tickets.map(async ticket => {
        const person = await Person.get(txn, ticket.participant[0].uid)
        nodes.push({
          id: person.uid,
          editable: (user && user.isAdmin) || myTickets.indexOf(ticket.uid) >= 0,
          details: 'persons/' + person.uid,
          name: person.firstName + ' ' + person.lastName,
          image: person.image,
          type: 'person',
          links: {
            topics: person.topics && person.topics.map(topic => handleTopic(topic, person.id, 'persons'))
          }
        })
      }))
      return {nodes}
    } finally {
      txn.discard()
    }
  }

  return {
    rebuild,
    getGraph,
    getAllTickets
  }
}
