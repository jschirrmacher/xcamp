module.exports = function ({ models }) {
  function assert(event, condition, message) {
    if (!condition) {
      const originalFunc = Error.prepareStackTrace
      const err = new Error()
      Error.prepareStackTrace = (err, stack) => stack.map(e => e.getFileName())
      const currentfile = err.stack.shift()
      const callerFile = err.stack.find(s => s !== currentfile).split(/[\\/]/).pop()
      Error.prepareStackTrace = originalFunc
      throw `Read model '${callerFile}', event '${event.type}': ${message}`
    }
  }
  
  function assertEventContent(channelId, userId) {
    assert(channelId, 'No channelId')
    assert(userId, 'No userId')
    assert(models.topic.getById(channelId), 'Unknown channelId')
    assert(models.user.getById(userId), 'Unknown userId')
  }

  return {
    userAdded: {
      name: 'user-added',
      construct: user => {
        assert(user, 'No user')
        assert(user.id, 'No user.id')
        return { user }
      }
    },

    userRemoved: {
      name: 'user-removed',
      construct: userId => {
        assert(userId, 'No userId')
        assert(models.user.getById(userId), 'Referenced user doesnt exist')
        return { userId }
      }
    },

    channelAdded: {
      name: 'channel-added',
      construct: channel => {
        assert(channel, 'No channel')
        assert(channel.id, 'No channel id')
        assert(!models.topic.getById(channel.id), 'Channel already exists')
        return { channel }
      }
    },

    channelRemoved: {
      name: 'channel-removed',
      construct: channelId => {
        assert(channelId, 'No channelId')
        assert(models.topic.getById(channelId), 'Channel doesn\'t exists')
        return { channelId }
      }
    },

    subscriptionAdded: {
      name: 'subscription-added',
      construct: (channelId, userId) => {
        assertEventContent(channelId, userId)
        return { channelId, userId }
      }
    },

    subscriptionRemoved: {
      name: 'subscription-removed',
      construct: (channelId, userId) => {
        assertEventContent(channelId, userId)
        return { channelId, userId }
      }
    },
  }
}
