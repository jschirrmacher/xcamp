'use strict'

module.exports = (dgraphClient, dgraph, Person) => {
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

  function handleSubNodes(data, type, shape, nodes, links) {
    if (data[type + 's']) {
      data[type + 's'].forEach(sub => {
        const found = nodes.find(node => node.id === sub.uid)
        if (!found) {
          nodes.push({id: sub.uid, name: sub.name, type, shape, numLinks: 1})
        } else {
          found.numLinks++
        }
        links.push({source: data.uid, target: sub.uid})
      })
    }
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
     { payment paid tickets { participant { uid firstName lastName email}}}}`)
    await Promise.all(data.getJson().all.map(async invoice => {
      if (invoice.payment !== 'paypal' || invoice.paid) {
        await Promise.all(invoice.tickets.map(async ticket => {
          tickets[ticket.participant[0].uid] = ticket
        }))
      }
    }))
    return Object.values(tickets)
  }

  async function getGraph(user = null) {
    const txn = dgraphClient.newTxn()
    try {
      const visible = true, open = true, shape = 'circle'
      const links = []

      const base = await txn.query('{ all(func: eq(type, "root")) {uid name image topics {uid name}}}')
      const xcamp = Object.assign(base.getJson().all[0], {type: 'root', shape, open, visible})
      xcamp.id = xcamp.uid
      const nodes = [xcamp]
      handleSubNodes(xcamp, 'topic', null, nodes, links)
      delete xcamp.uid

      const myTickets = getTickets(user)
      const tickets = await getAllTickets(txn)
      await Promise.all(tickets.map(async ticket => {
        const person = await Person.get(txn, ticket.participant[0].uid)
        nodes.push({
          id: person.uid,
          editable: myTickets.indexOf(ticket.uid) !== false,
          name: person.firstName + ' ' + person.lastName,
          details: 'persons/' + person.uid,
          image: person.image,
          shape,
          visible
        })
        handleSubNodes(person, 'topic', null, nodes, links)
      }))

      nodes.forEach(node => {
        if (node.numLinks) {
          node.fontSize = 1 + Math.min(2, (node.numLinks - 1) / 5)
        }
      })
      return {nodes, links}
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
