const rcChannels = {}
const rcUsers = {}
const rcMembers = {}

module.exports = ({ config, timerObject = global }) => {
  async function getFromRC(path) {
    const headers = {
      'X-Auth-Token': config.chat.bot.token,
      'X-User-Id': config.chat.bot.userId
    }
    // console.log('GET https://chat.xcamp.co/api' + path)
    const response = await fetch('https://chat.xcamp.co/api' + path, { headers })
    const content = response.headers.get('content-type').match(/json/) ? await response.json() : await response.text()
    if (!response.ok || !content.success) {
      throw { success: false, message: response.status + ' ' + response.statusText, content }
    }
    return content
  }

  async function updateRCData() {
    function userAdded(user) {
      rcUsers[user._id] = {
        id: user._id,
        type: 'person',
        name: user.name,
        image: 'https://chat.xcamp.co/avatar/' + user.username,
        channel: '/direct/' + user.username,
        links: { topics: [] },
        open: true
      }
    }

    function userRemoved(userId) {
      rcUsers[userId].links.topics.forEach(channelId => subscriptionRemoved(channelId, userId))
      delete rcUsers[userId]
    }

    function channelAdded(channel) {
      rcChannels[channel._id] = {
        id: channel._id,
        type: 'topic',
        name: channel.topic || channel.name,
        details: channel.description,
        channel: '/channel/' + channel.name,
        links: { persons: [] },
        open: true
      }
      rcMembers[channel._id] = {}
    }

    function channelRemoved(channelId) {
      rcChannels[channelId].links.persons.forEach(userId => subscriptionRemoved(channelId, userId))
      delete rcChannels[channelId]
    }

    function subscriptionAdded(channelId, userId) {
      rcChannels[channelId].links.persons.push(userId)
      rcUsers[userId].links.topics.push(channelId)
      rcMembers[channelId][userId] = true
    }

    function subscriptionRemoved(channelId, userId) {
      rcChannels[channelId].links.persons = rcChannels[channelId].links.persons.filter(id => id !== userId)
      rcUsers[userId].links.topics = rcUsers[userId].links.topics.filter(id => id !== channelId)
      delete rcMembers[channelId][userId]
    }

    try {
      const users = (await getFromRC('/v1/users.list')).users.filter(user => user.active && user.roles.includes('user'))
      const knownUserIds = Object.keys(rcUsers)
      users.filter(user => !knownUserIds.some(knownId => user._id === knownId)).forEach(userAdded)
      knownUserIds.filter(id => !users.some(user => id === user._id)).forEach(userRemoved)

      const channels = (await getFromRC('/v1/channels.list')).channels
      const knownChannelIds = Object.keys(rcChannels)
      channels.filter(channel => !knownChannelIds.some(knownId => channel._id === knownId)).forEach(channelAdded)
      knownChannelIds.filter(id => !channels.some(channel => id === channel._id)).forEach(channelRemoved)

      await Promise.all(channels.map(async channel => {
        const memberIds = (await getFromRC('/v1/channels.members?roomId=' + channel._id)).members.map(member => member._id)
        memberIds.forEach(id => rcMembers[channel._id][id] || subscriptionAdded(channel._id, id))
        Object.keys(rcMembers[channel._id]).forEach(id => !memberIds.some(memberId => id === memberId) && (subscriptionRemoved(channel._id, id) || true))
      }))
    } catch (error) {
      console.error(error)
    }

    timerObject.setTimeout(updateRCData, 5000)
  }

  updateRCData()

  return {
    getGraph(user) {
      const nodes = Object.values(rcChannels).concat(Object.values(rcUsers))
      return { nodes, myNode: user && user.personId }
    }
  }
}
