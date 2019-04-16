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
            assert(event.person.id, 'No person id found')
            persons[event.person.id] = Object.assign(persons[event.person.id] || {}, event.person)
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
