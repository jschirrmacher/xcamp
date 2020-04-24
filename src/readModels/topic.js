const { channelAdded, channelRemoved } = require('../events')

module.exports = function ({ store }) {
  const topics = {
    byId: {},
    byName: {}
  }

  store.on(channelAdded, (event, assert) => {
    assert(event.channel, 'No channel')
    assert(event.channel.id, 'No channel id')
    assert(!topics.byId[event.channel.id], 'Channel already exists')
    topics.byId[event.channel.id] = event.channel
    topics.byName[event.channel.name.toLowerCase()] = event.channel
  })

  store.on(channelRemoved, (event, assert) => {
    assert(event.channelId, 'No channelId')
    assert(topics.byId[event.channelId], 'Channel doesn\'t exists')
    delete topics.byName[topics.byId[event.channelId].name]
    delete topics.byId[event.channelId]
  })

  return {
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
