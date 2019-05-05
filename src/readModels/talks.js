const talkInfoReceiver = 'j.schirrmacher@justso.de'

module.exports = function () {
  const talks = {}

  return {
    handleEvent(event, assert) {
      switch (event.type) {
        case 'talk-published':
          assert(event.person, 'No person in event')
          assert(event.person.id, 'No person id in event')
          talks[event.person.id] = {person: {id: event.person.id, name: event.person.name}, talk: event.talk}
          break

        case 'talk-withdrawn':
          assert(event.person, 'No person in event')
          assert(event.person.id, 'No person id in event')
          delete talks[event.person.id]
          break
      }
    },

    getAll() {
      return Object.values(talks)
    },

    getByUserId(userId) {
      return talks[userId]
    }
  }
}
