talkInfoReceiver = 'j.schirrmacher@justso.de'

module.exports = function ({logger}) {
  const talks = {}

  return {
    handleEvent(event) {
      try {
        switch (event.type) {
          case 'talk-published':
            talks[event.person.id] = {person: {id: event.person.id, name: event.person.name}, talk: event.talk}
            break

          case 'talk-withdrawn':
            delete talks[event.person.id]
            break
        }
      } catch (error) {
        logger.error(error)
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
