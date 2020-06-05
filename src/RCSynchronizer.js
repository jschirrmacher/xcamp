
module.exports = ({ readModels, store, adapters }) => {
  const rocketChat = adapters.RocketChat
  const events = require('./events')({ models: readModels })

  async function emitChanges(known, newValues, fields, event) {
    try {
      const changes = Object.keys(fields)
        .filter(name => (newValues[name] || '') !== known[fields[name]])
        .map(name => ({[fields[name]]: newValues[name] || ''}))
      if (changes.length) {
        await store.emit(event, Object.assign({ id: known.id }, ...changes ))
      }
    } catch (error) {
      debugger
    }
  }

  return async function update() {
    async function userAdded(rcUser) {
      await store.emit(events.userAdded, {
        id: rcUser._id,
        name: rcUser.name,
        username: rcUser.username,
        email: rcUser.email
      })
    }

    async function userRemoved(user) {
      await store.emit(events.userRemoved, user.id)
    }

    async function channelAdded(rcChannel) {
      await store.emit(events.channelAdded, {
        id: rcChannel._id,
        name: rcChannel.name,
        topic: rcChannel.topic,
        details: rcChannel.description
      })
    }

    async function channelRemoved(channelId) {
      await store.emit(events.channelRemoved, channelId)
    }

    async function updateUser(rcUser) {
      rcUser.email = rcUser.emails[0] && rcUser.emails[0].address
      const fields = {
        name: 'name',
        username: 'username',
        email: 'email',
        bio: 'details',
      }
      await emitChanges(readModels.user.getById(rcUser._id), rcUser, fields, events.userChanged)
    }

    async function updateChannel(channel) {
      const fields = {
        name: 'name',
        topic: 'topic',
        description: 'details',
      }
      emitChanges(readModels.topic.getById(channel._id), channel, fields, events.channelChanged)
    }

    try {
      const users = (await rocketChat.listUsers()).filter(user => user.active && user.roles.includes('user'))
      const knownUsers = readModels.user.getAll()
      await Promise.all(users.filter(user => !knownUsers.some(known => known.id === user._id)).map(userAdded))
      await Promise.all(knownUsers.filter(known => !users.some(user => known.id === user._id)).map(userRemoved))
      await Promise.all(users.map(updateUser))

      const channels = await rocketChat.listChannels()
      const knownChannels = readModels.topic.getAll()
      await Promise.all(channels.filter(channel => !knownChannels.some(known => known.id === channel._id)).map(channelAdded))
      await Promise.all(knownChannels.filter(known => !channels.some(channel => known.id === channel._id)).map(channelRemoved))
      await Promise.all(channels.map(updateChannel))

      await Promise.all(channels.map(async channel => {
        const memberIds = (await rocketChat.getMembersOfChannel(channel._id)).map(member => member._id)
        await Promise.all(memberIds.map(async userId => {
          if (!readModels.subscriptions.subscribed(channel._id, userId)) {
            await store.emit(events.subscriptionAdded, channel._id, userId)
          }
        }))
        await Promise.all(readModels.subscriptions.getMembers(channel._id).map(async userId => {
          if (!memberIds.includes(userId)) {
            await store.emit(events.subscriptionRemoved, channel._id, userId)
          }
        }))
      }))
    } catch (error) {
      console.error(error)
    }

    setTimeout(update, 5000)
  }
}
