const events = require('./events')

module.exports = ({ readModels, store, config }) => {
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

  async function updateRCData() {
    async function userAdded(rcUser) {
      await store.emit(events.userAdded, { user: {
        id: rcUser._id,
        name: rcUser.name,
        username: rcUser.username,
        email: rcUser.email
      } })
    }

    async function userRemoved(user) {
      await store.emit(events.userRemoved, { userId: user.id })
    }

    async function channelAdded(rcChannel) {
      await store.emit(events.channelAdded, { channel: {
        id: rcChannel._id,
        name: rcChannel.name,
        topic: rcChannel.topic,
        details: rcChannel.description
      } })
    }

    async function channelRemoved(channelId) {
      await store.emit(events.channelRemoved({ channelId }))
    }

    try {
      const users = (await getFromRC('/v1/users.list')).users.filter(user => user.active && user.roles.includes('user'))
      const knownUsers = readModels.user.getAll()
      await Promise.all(users.filter(user => !knownUsers.some(known => known.id === user._id)).map(userAdded))
      await Promise.all(knownUsers.filter(known => !users.some(user => known.id === user._id)).map(userRemoved))

      const channels = (await getFromRC('/v1/channels.list')).channels
      const knownChannels = readModels.topic.getAll()
      await Promise.all(channels.filter(channel => !knownChannels.some(known => known.id === channel._id)).map(channelAdded))
      await Promise.all(knownChannels.filter(known => !channels.some(channel => known.id === channel._id)).map(channelRemoved))

      await Promise.all(channels.map(async channel => {
        const memberIds = (await getFromRC('/v1/channels.members?roomId=' + channel._id)).members.map(member => member._id)
        await Promise.all(memberIds.map(async userId => {
          if (!readModels.subscriptions.subscribed(channel._id, userId)) {
            await store.emit(events.subscriptionAdded, { channelId: channel._id, userId })
          }
        }))
        await Promise.all(readModels.subscriptions.getMembers(channel._id).map(async userId => {
          if (!memberIds.includes(userId)) {
            await store.emit(events.subscriptionRemoved, { channelId: channel._id, userId })
          }
        }))
      }))
    } catch (error) {
      console.error(error)
    }

    setTimeout(updateRCData, 5000)
  }

  updateRCData()
}
