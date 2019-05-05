module.exports = function () {
  const topics = {}

  return {
    handleEvent(event, assert) {
      switch (event.type) {
        case 'topic-created':
          assert(event.topic, 'No topic found in event')
          assert(event.topic.id, 'No topic id found in event')
          assert(!topics[event.topic.id], 'Topic id already exists')
          topics[event.topic.id] = event.topic
          break

        case 'topic-updated':
          assert(event.topic, 'No topic found in event')
          assert(event.topic.id, 'No topic id found in event')
          assert(topics[event.topic.id], 'Topic doesn\'t exists')
          topics[event.topic.id] = Object.assign(topics[event.topic.id], event.topic)
          break

      }
    },

    getAll() {
      return Object.values(topics)
    },

    getById(id) {
      return topics[id]
    }
  }
}
