const stream = require('stream')

let lastPersonEvent
let lastApproval

module.exports = class From_15 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    function exchangeApprovalEvent() {
      event.ts = lastApproval
      this.push(event)
      this.push({ts: event.ts, type: 'newsletter-approved', personId: event.person.id})
      lastApproval = undefined
      callback()
    }

    if (event.type === 'person-created') {
      lastPersonEvent = {ts: new Date(event.ts), personId: event.person.id}
    } else if (event.type === 'newsletter-subscription') {
      event.personId = event.customer.person[0].uid
      delete event.customer
    } else if (event.type === 'newsletter-approved' && !event.personId) {
      if (lastPersonEvent && new Date(event.ts) - lastPersonEvent.ts < 20000) {
        event.personId = lastPersonEvent.personId
        lastPersonEvent = undefined
      } else {
        lastApproval = new Date(event.ts)
        callback()
        return
      }
    } else if (event.type === 'person-created' && lastApproval && new Date(event.ts) - lastApproval < 10000) {
      return exchangeApprovalEvent.call(this)
    } else if (event.type === 'applied-to-reduced' && lastApproval && new Date(event.ts) - lastApproval < 10000) {
      return exchangeApprovalEvent.call(this)
    } else if (lastApproval) {
      throw 'Didnt find create-person or applied-to-reduced'
    }

    this.push(event)
    callback()
  }
}
