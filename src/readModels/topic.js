module.exports = function ({logger}) {
  const topics = {}

  return {
    handleEvent(event) {
      function assert(condition, message) {
        if (!condition) {
          throw `Read model '${__filename}, event '${event.type}' (${event.ts}): ${message}`
        }
      }

      try {
        switch (event.type) {
          case 'topic-created':
            assert(event.topic.id, 'No topic id found in event')
            assert(!topics[event.topic.id], 'Topic id already exists')
            topics[event.topic.id] = event.topic
            break

          case 'topic-updated':
            assert(event.topic.id, 'No topic id found in event')
            assert(topics[event.topic.id], 'Topic doesn\'t exists')
            topics[event.topic.id] = Object.assign(topics[event.topic.id], event.topic)
            break

        }
      } catch (error) {
        logger.error(error)
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
