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
          const image = 'http://xcamp.dilab.co/xcamp.png'
          mu.setSetJson({
            name: 'XCamp 2018', type: 'root', image, topics: [
              {type: 'topic', name: 'Design Thinking'},
              {type: 'topic', name: 'Lean Startup'},
              {type: 'topic', name: 'User Experience'},
              {type: 'topic', name: 'Agile Development'},
              {type: 'topic', name: 'DevOps'}
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

  async function getGraph() {
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
      await Promise.all(all.map(async ticket => {
        const person = await Person.get(txn, ticket.participant[0].uid)
        nodes.push({
          id: person.uid,
          name: person.firstName + ' ' + person.lastName,
          details: '/netvis/persons/' + person.uid,
          image: person.image,
          shape,
          visible
        })
        handleSubNodes(person, 'topic', 'rect', nodes, links)
        return person
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