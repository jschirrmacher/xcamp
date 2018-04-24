module.exports = dgraphClient => ({
  rebuild: () => {
    async function dropAll(dgraphClient) {
      const op = new dgraph.Operation()
      op.setDropAll(true)
      await dgraphClient.alter(op)
    }

    async function setSchema(dgraphClient) {
      const op = new dgraph.Operation()
      op.setSchema(`type: string @index(term) .`)
      await dgraphClient.alter(op)
    }

    return dropAll(dgraphClient).then(() => setSchema(dgraphClient))
  },

  getGraph: () => {
    const query = `{
      all(func: anyofterms(type, "person topic")) {
        id: uid
        type
        shape
        name
        image
        topic {
          uid
        }
      }
    }`
    return dgraphClient.newTxn().query(query)
      .then(data => {
        const all = data.getJson().all
        const links = []
        const nodes = all.map(node => {
          const {topic, ...result} = node
          if (topic) {
            topic.forEach(link => links.push({source: node.id, target: link.uid}))
          }
          if (result.type === 'person') {
            result.details = '/persons/' + result.id
          }
          result.visible = result.type === 'person'
          result.open = result.name === 'XCamp'
          return result
        })
        return {nodes, links}
      })
  }
})
