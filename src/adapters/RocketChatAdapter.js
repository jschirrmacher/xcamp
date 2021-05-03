module.exports = function({ config }) {
  async function getFromRC(method, path, data) {
    const isJSON = data instanceof Object
    const headers = Object.assign({
      'X-Auth-Token': config.chat.bot.token,
      'X-User-Id': config.chat.bot.userId
    }, isJSON ? {'Content-Type': 'application/json'} : {})
    const body = isJSON ? JSON.stringify(data) : data
    const response = await fetch(config.chat.url + 'api' + path, { method, headers, body })
    const content = response.headers.get('content-type').match(/json/) ? await response.json() : await response.text()
    if (!response.ok || !content.success) {
      const httpError = response.status + ' ' + response.statusText
      throw { success: false, message: content.error || httpError, content }
    }
    return content
  }

  return {
    async listUsers() {
      return (await getFromRC('get', '/v1/users.list')).users
    },

    async listChannels() {
      return (await getFromRC('get', '/v1/channels.list')).channels
    },

    async getMembersOfChannel(channelId) {
      return (await getFromRC('get', '/v1/channels.members?roomId=' + channelId)).members
    },

    async createUser(userData) {
      return getFromRC('post', '/v1/users.create', userData).user
    }
  }
}
