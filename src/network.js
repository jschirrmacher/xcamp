'use strict'

module.exports = (dgraphClient, dgraph, Person, QueryFunction) => {
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
        if (!nodes.some(node => node.id === sub.uid)) {
          nodes.push({id: sub.uid, name: sub.name, type, shape})
        }
        links.push({source: data.uid, target: sub.uid})
      })
    }
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
      handleSubNodes(xcamp, 'topic', 'rect', nodes, links)
      delete xcamp.uid

      const data = await txn.query(`{ all(func: anyofterms(type, "ticket")) { participant { uid }}}`)
      const all = data.getJson().all
      const uids = []
      const myTickets = user ? user.invoices["0"].tickets.map(ticket => ticket.uid) : []
      await Promise.all(all.map(async ticket => {
        const uid = ticket.participant[0].uid
        if (uids.indexOf(uid) < 0) {
          uids.push(uid)
          const person = await Person.get(txn, uid)
          nodes.push({
            id: person.uid,
            editable: myTickets.indexOf(ticket.uid) !== false,
            name: person.firstName + ' ' + person.lastName,
            details: 'persons/' + person.uid,
            image: person.image,
            shape,
            visible
          })
          handleSubNodes(person, 'topic', 'rect', nodes, links)
          return person
        }
      }))
      return {nodes, links}
    } finally {
      txn.discard()
    }
  }

  return {
    rebuild,
    getGraph
  }
}
