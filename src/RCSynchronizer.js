module.exports = ({ readModels, store, config }) => {
  const events = require('./events')({ models: readModels })

  async function getFromRC(path) {
    const headers = {
      'X-Auth-Token': config.chat.bot.token,
      'X-User-Id': config.chat.bot.userId
    }
    const response = await fetch(config.chat.url + 'api' + path, { headers })
    const content = response.headers.get('content-type').match(/json/) ? await response.json() : await response.text()
    if (!response.ok || !content.success) {
      throw { success: false, message: response.status + ' ' + response.statusText, content }
    }
    return content
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

    async function updateUser(user) {
      const known = readModels.user.getById(user._id)
      const fields = {
        name: 'name',
        username: 'username',
        bio: 'details',
      }
      const changes = Object.keys(fields).filter(name => user[name] !== known[fields[name]]).map(name => ({[name]: user[name]}))
      if (changes.length) {
        await store.emit(events.userChanged, Object.assign({ id: user._id }, ...changes ))
      }
    }

    async function updateChannel(channel) {
      const currentTopic = readModels.topic.getById(channel._id)
      const newDetails = (channel.announcement || '') + '\n' + (channel.description || '')
      if (newDetails !== currentTopic.details) {
        await store.emit(events.channelChanged, { id: channel._id, details: newDetails })
      }
    }

    try {
      const users = (await getFromRC('/v1/users.list')).users.filter(user => user.active && user.roles.includes('user'))
      const knownUsers = readModels.user.getAll()
      await Promise.all(users.filter(user => !knownUsers.some(known => known.id === user._id)).map(userAdded))
      await Promise.all(knownUsers.filter(known => !users.some(user => known.id === user._id)).map(userRemoved))
      await Promise.all(users.map(updateUser))

      const channels = (await getFromRC('/v1/channels.list')).channels
      const knownChannels = readModels.topic.getAll()
      await Promise.all(channels.filter(channel => !knownChannels.some(known => known.id === channel._id)).map(channelAdded))
      await Promise.all(knownChannels.filter(known => !channels.some(channel => known.id === channel._id)).map(channelRemoved))
      await Promise.all(channels.map(updateChannel))

      await Promise.all(channels.map(async channel => {
        const memberIds = (await getFromRC('/v1/channels.members?roomId=' + channel._id)).members.map(member => member._id)
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
