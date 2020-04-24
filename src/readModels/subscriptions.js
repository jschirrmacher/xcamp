const { userAdded, userRemoved, channelAdded, channelRemoved, subscriptionAdded, subscriptionRemoved } = require('../events')

module.exports = function ({ store, models }) {
  const members = {}
  const subscriptions = {}

  function assertEventContent(event, assert) {
    assert(event.channelId, 'No channelId')
    assert(event.userId, 'No userId')
    assert(models.topic.getById(event.channelId), 'Unknown channelId')
    assert(models.user.getById(event.userId), 'Unknown userId')
  }

  store.on(subscriptionAdded, (event, assert) => {
    assertEventContent(event, assert)
    members[event.channelId] = [...(members[event.channelId] || []), event.userId]
    subscriptions[event.userId] = [...(subscriptions[event.userId] || []), event.channelId]
  })

  store.on(subscriptionRemoved, (event, assert) => {
    assertEventContent(event, assert)
    delete subscriptions[event.userId]
    delete members[event.channelId]
  })

  store.on(userAdded, (event, assert) => {
    assert(event.user, 'No user')
    assert(event.user.id, 'No user id')
    subscriptions[event.user.id] = []
  })

  store.on(userRemoved, (event, assert) => {
    assert(event.userId, 'No userId')
    Object.keys(members).forEach(channelId => {
      members[channelId] = members[channelId].filter(id => id !== event.userId)
    })
    delete subscriptions[event.userId]
  })

  store.on(channelAdded, (event, assert) => {
    assert(event.channel, 'No channel')
    assert(event.channel.id, 'No channel id')
    members[event.channel.id] = []
  })

  store.on(channelRemoved, (event, assert) => {
    assert(event.channelId, 'No channelId')
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
      return members[channelId].includes(userId)
    }
  }
}
