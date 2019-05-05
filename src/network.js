'use strict'

const select = require('./lib/select')

module.exports = (dgraphClient, dgraph, store, readModels) => {
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
          const rootId = assigned.getUidsMap().get('blank-0')
          store.add({type: 'root-created', root: {id: rootId, name: data.name, image: data.image}})
          rootTopics.forEach((name, num) => {
            const topicId = assigned.getUidsMap().get(`blank-${num + 1}`)
            store.add({type: 'topic-created', topic: {id: topicId, name}})
            store.add({type: 'topic-root-linked', topicId, rootId })
          })
        } finally {
          txn.discard()
        }
      })
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

  async function getGraph(user = null) {
    const nodes = readModels.network.getAll()
      .map(node => getPublicViewOfNode(node, user))
    return {nodes, myNode: getNodeId(user)}
  }

  function getPublicViewOfNode(node, user) {
    const fields = ['id', 'editable', 'details', 'name', 'image', 'type', 'links']
    if (user && (user.isAdmin || node.id === user.id)) {
      node.editable = true
      fields.push('access_code')
    }
    if (node.type === 'person') {
      if (!node.image) {
        node.image = 'user.png'
      } else if (node.image.match(/^\w+\/\w+:.*$/)) {
        node.image = 'network/persons/' + node.id + '/picture/' + encodeURIComponent(node.image.replace(/.*:/, ''))
      }
      node.details = 'network/persons/' + node.id
      node.name = node.firstName + ' ' + node.lastName
      node = select(node, fields)
    }
    return node
  }

  function getNodeId(user) {
    return user && (user.type === 'customer' ? user.person[0].uid : user.uid)
  }

  return {
    rebuild,
    getGraph,
    getAllTickets,
    getNodeId,
    getPublicViewOfNode
  }
}
