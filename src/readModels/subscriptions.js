module.exports = function ({ store, models }) {
  const { userAdded, userRemoved, channelAdded, channelRemoved, subscriptionAdded, subscriptionRemoved } = require('../events')({ models })
  const members = {}
  const subscriptions = {}

  store.on(subscriptionAdded, event => {
    members[event.channelId] = [...(members[event.channelId] || []), event.userId]
    subscriptions[event.userId] = [...(subscriptions[event.userId] || []), event.channelId]
  })

  store.on(subscriptionRemoved, event => {
    delete subscriptions[event.userId]
    delete members[event.channelId]
  })

  store.on(userAdded, event => {
    subscriptions[event.user.id] = []
  })

  store.on(userRemoved, event => {
    Object.keys(members).forEach(channelId => {
      members[channelId] = members[channelId].filter(id => id !== event.userId)
    })
    delete subscriptions[event.userId]
  })

  store.on(channelAdded, event => {
    members[event.channel.id] = []
  })

  store.on(channelRemoved, event => {
    Object.keys(subscriptions).forEach(userId => {
      subscriptions[userId] = subscriptions[userId].filter(id => id !== event.channelId)
    })
    delete members[event.channelId]
  })

  return {
    dependencies: ['user', 'topic'],

    getSubscriptions(userId) {
      return subscriptions[userId]
    },

    getMembers(channelId) {
      return members[channelId]
    },

    subscribed(channelId, userId) {
      return members[channelId] && members[channelId].includes(userId)
    }
  }
}
