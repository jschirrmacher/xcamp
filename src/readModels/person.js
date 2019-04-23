module.exports = function ({logger, models}) {
  const persons = {}

  return {
    handleEvent(event) {
      function assert(condition, message) {
        if (!condition) {
          throw `Read model '${__filename}, event '${event.type}' (${event.ts}): ${message}`
        }
      }

      try {
        switch (event.type) {
          case 'person-created':
            assert(event.person.id, 'No person id found in event')
            assert(!persons[event.person.id], 'A person with this id already exists')
            persons[event.person.id] = event.person
            break

          case 'person-updated':
            assert(event.person.id, 'No person id found in event')
            assert(persons[event.person.id], 'A person with this id doesn\'t exist')
            persons[event.person.id] = Object.assign(persons[event.person.id], event.person)
            break

          case 'person-topic-linked':
            assert(event.topicId, 'No topic id found in event')
            assert(event.personId, 'No person id found in event')
            assert(persons[event.personId], 'Person not found')
            const topic = models.topic.getById(event.topicId)
            assert(topic, 'Topic not found')
            persons[event.personId].topics = persons[event.personId].topics || []
            assert(!persons[event.personId].topics.some(t => t.id === event.topicId), 'Topic already linked')
            persons[event.personId].topics.push(topic)
            break

          case 'person-topic-unlinked':
            assert(event.topicId, 'No topic id found in event')
            assert(event.personId, 'No person id found in event')
            assert(persons[event.personId], 'Person not found')
            assert(persons[event.personId].topics, 'Person doesn\'t have topics')
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
