module.exports = function ({logger}) {
  const persons = {}

  return {
    handleEvent(event) {
      function assert(condition, message) {
        if (!condition) {
          throw `Event '${event.type}' (${event.ts}): ${message}`
        }
      }

      try {
        switch (event.type) {
          case 'person-updated':
            assert(event.person.id, 'No person id found in event')
            persons[event.person.id] = Object.assign(persons[event.person.id] || {}, event.person)
            break

          case 'person-topic-linked':
            assert(event.topic && event.topic.id, 'No topic id found in event')
            assert(event.personId, 'No person id found in event')
            assert(persons[event.personId], 'Person not found')
            assert(!persons[event.personId].topics.some(t => t.id === event.topic.id), 'Topic already linked')
            persons[event.personId].topics.push(event.topic)
            break

          case 'person-topic-unlinked':
            assert(event.topicId, 'No topic id found in event')
            assert(event.personId, 'No person id found in event')
            assert(persons[event.personId], 'Person not found')
            persons[event.personId].topics = persons[event.personId].topics.filter(t => t.id !== event.topicId)
            break
        }
      } catch (error) {
        logger.error(error)
      }
    },

    getAll() {
      return Object.values(persons)
    },

    getById(id) {
      return persons[id]
    }
  }
}
