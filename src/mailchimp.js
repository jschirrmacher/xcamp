const btoa = require('btoa')
const md5 = require('md5')

module.exports = function (apiKey, fetch) {
  function fromMailChimp(path, options = {}) {
    options.headers = Object.assign({}, options.headers, {authorization: 'Basic ' + btoa('x:' + apiKey)})
    return fetch('https://' + apiKey.replace(/.*-(\w+)$/, '$1') + '.api.mailchimp.com/3.0' + path, options)
  }

  async function addTags(listPath, email, tags) {
    const segmentPath = listPath + '/segments'
    const segments = await fromMailChimp(segmentPath)
    return Promise.all(tags.map(async tag => {
      const segment = segments.segments.find(s => s.name === tag)
      const method = 'POST'
      if (!segment) {
        const body = JSON.stringify({name: tag, static_segment: [email]})
        return fromMailChimp(segmentPath, {method, body})
      } else {
        const body = JSON.stringify({email_address: email})
        return fromMailChimp(`${segmentPath}/${segment.id}/members`, {method, body})
      }
    }))
  }

  async function addSubscriber(listId, member, tags) {
    const listPath = `/lists/${listId}`
    const email = member.email_address.toLowerCase()
    const path = `${listPath}/members/${md5(email)}`
    member.status = 'subscribed'
    await fromMailChimp(path, {method: 'put', body: JSON.stringify(member)})
    return addTags(listPath, email, tags)
  }

  return {addSubscriber}
}
