module.exports = (dgraphClient, dgraph) => ({
  rebuild: () => {
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

    return dropAll(dgraphClient).then(() => setSchema(dgraphClient))
  },

  getGraph: async () => {
    const query = `{
      all(func: anyofterms(type, "person topic customer ticket invoice")) {
        id: uid
        type
        shape
        name
        image
        topics {
          id: uid
          name
        }
        participant {
          id: uid
          name
        }
      }
    }`
    const txn = dgraphClient.newTxn()
    try {
      const data = await txn.query(query)
      const all = data.getJson().all
      const links = []
      const nodes = all.map(node => {
        const {topics, participant, ...result} = node
        if (topics) {
          topics.forEach(link => links.push({source: node.id, target: link.id}))
        }
        if (participant) {
          participant.forEach(link => links.push({source: node.id, target: link.id}))
        }
        if (result.type === 'person') {
          result.details = '/persons/' + result.id
          result.shape = 'circle'
        } else {
          result.shape = 'rect'
        }
        result.visible = result.type === 'person'
        result.open = result.name === 'XCamp'
        return result
      })
      return {nodes, links}
    } finally {
      txn.discard()
    }
  }
})
