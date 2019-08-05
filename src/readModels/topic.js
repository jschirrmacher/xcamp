module.exports = function () {
  const topics = {
    byId: {},
    byName: {}
  }

  return {
    handleEvent(event, assert) {
      switch (event.type) {
        case 'node-created':
          if (event.node.type === 'topic') {
            assert(event.node.id, 'No node id found in event')
            assert(event.node.name, 'No node name found in event')
            assert(!topics.byId[event.node.id], 'Node id already exists')
            topics.byId[event.node.id] = event.node
            topics.byName[event.node.name.toLowerCase()] = event.node
          }
          break

        case 'node-updated':
          assert(event.node, 'No node found in event')
          assert(event.node.id, 'No node id found in event')
          if (topics.byId[event.node.id]) {
            topics.byId[event.node.id] = Object.assign(topics.byId[event.node.id], event.node)
          }
          break

      }
    },

    getAll() {
      return Object.values(topics.byId)
    },

    getById(id) {
      return topics.byId[id]
    },

    getByName(name) {
      return topics.byName[name.toLowerCase()]
    }
  }
}
