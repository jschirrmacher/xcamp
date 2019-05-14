module.exports = function () {
  const topics = {
    byId: {},
    byName: {}
  }

  return {
    handleEvent(event, assert) {
      switch (event.type) {
        case 'topic-created':
          assert(event.topic, 'No topic found in event')
          assert(event.topic.id, 'No topic id found in event')
          assert(event.topic.name, 'No topic name found in event')
          assert(!topics.byId[event.topic.id], 'Topic id already exists')
          topics.byId[event.topic.id] = event.topic
          topics.byName[event.topic.name.toLowerCase()] = event.topic
          break

        case 'topic-updated':
          assert(event.topic, 'No topic found in event')
          assert(event.topic.id, 'No topic id found in event')
          assert(topics.byId[event.topic.id], 'Topic doesn\'t exists')
          topics.byId[event.topic.id] = Object.assign(topics.byId[event.topic.id], event.topic)
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
