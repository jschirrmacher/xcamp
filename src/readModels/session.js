module.exports = function () {
  const sessions = {}

  return {
    handleEvent(event, assert) {
      switch (event.type) {
        case 'talk-published':
          assert(event.person, 'No person in event')
          assert(event.person.id, 'No person id in event')
          sessions[event.person.id] = {person: {id: event.person.id, name: event.person.name}, talk: event.talk}
          break

        case 'talk-withdrawn':
          assert(event.person, 'No person in event')
          assert(event.person.id, 'No person id in event')
          delete sessions[event.person.id]
          break

        case 'person-updated':
          assert(event.person, 'No person in event')
          if (event.person.talk && sessions[event.person.id]) {
            sessions[event.person.id].talk = event.person.talk
          }
          break
      }
    },

    getAll() {
      return Object.values(sessions)
    },

    getByUserId(userId) {
      return sessions[userId]
    }
  }
}
