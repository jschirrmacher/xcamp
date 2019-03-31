const btoa = require('btoa')
const md5 = require('md5')

module.exports = function ({apiKey, eventListId}, tag, fetch, store) {
  function fetchMailchimp(path, options = {}) {
    options.headers = Object.assign({}, options.headers, {authorization: 'Basic ' + btoa('x:' + apiKey)})
    return fetch('https://' + apiKey.replace(/.*-(\w+)$/, '$1') + '.api.mailchimp.com/3.0' + path, options)
  }

  async function addTags(email, tags) {
    const segmentPath = `/lists/${eventListId}/segments`
    const segments = await fetchMailchimp(segmentPath)
    return Promise.all(tags.map(async tag => {
      const segment = segments.segments.find(s => s.name === tag)
      const method = 'POST'
      if (!segment) {
        const body = JSON.stringify({name: tag, static_segment: [email]})
        return fetchMailchimp(segmentPath, {method, body})
      } else {
        const body = JSON.stringify({email_address: email})
        return fetchMailchimp(`${segmentPath}/${segment.id}/members`, {method, body})
      }
    }))
  }

  async function addSubscriber(customer) {
    const person = customer.person[0]
    const member = {
      email_address: person.email,
      merge_fields: {FNAME: person.firstName, LNAME: person.lastName}
    }
    const email = member.email_address.toLowerCase()
    const path = `/lists/${eventListId}/members/${md5(email)}`
    store.add({type: 'newsletter-approved', customer})
    member.status = 'subscribed'
    await fetchMailchimp(path, {method: 'put', body: JSON.stringify(member)})
  }

  return {addSubscriber, addTags}
}
