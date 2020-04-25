module.exports = function ({ store, models }) {
  const { channelAdded, channelRemoved } = require('../events')({ models })
  const topics = {
    byId: {},
    byName: {}
  }

  store.on(channelAdded, event => {
    topics.byId[event.channel.id] = event.channel
    topics.byName[event.channel.name.toLowerCase()] = event.channel
  })

  store.on(channelRemoved, event => {
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
