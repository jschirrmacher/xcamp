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
      .map(node => getPublicViewOfNode({...node}, user))
    return {nodes, myNode: user && user.personId}
  }

  function getImageURL(person) {
    if (person && person.image) {
      if (person.image.match(/^\w+\/\w+:.*$/)) {
        return 'network/persons/' + person.id + '/picture/' + encodeURIComponent(person.image.replace(/.*:/, ''))
      } else {
        return person.image
      }
    }
    return 'user.png'
  }

  function setAccountData(node, user) {
    node.accountPath = user.ticketIds.length > 1 ? 'accounts/my' : 'accounts/my/invoices/current'
  }

  function getPublicViewOfNode(node, user) {
    const fields = ['id', 'editable', 'details', 'url', 'name', 'image', 'type', 'links', 'description']
    if (hasAccess(user, node)) {
      node.editable = true
    }
    if (node.type === 'person') {
      fields.push('topics')
      fields.push('twitterName')
      fields.push('talk')
      node.image = getImageURL(node)
      node.details = 'network/persons/' + node.id
      node.name = node.firstName + ' ' + node.lastName
      if (node.editable) {
        fields.push('talkReady')
        fields.push('access_code')
        fields.push('accountPath')
        fields.push('email')
        setAccountData(node, user)
      }
      node = select(node, fields)
    }
    return node
  }

  function hasAccess(user, node) {
    if (!user) {
      return false
    }
    if (user.isAdmin) {
      return true
    }
    return user.ticketIds.indexOf(node.id) !== false
  }

  return {
    rebuild,
    getGraph,
    getAllTickets,
    getPublicViewOfNode,
    getImageURL
  }
}
