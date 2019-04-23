const stream = require('stream')
const diff = require('../lib/diff')
const topics = {}

module.exports = class From_5 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    switch (event.type) {
      case 'customer-added':
        event.type = 'customer-created'
        const person = event.customer.person
        delete event.customer.person
        event.customer.personId = person.id
        this.push({ts: event.ts, type: 'person-created', person})
        this.push(event)
        break

      case 'invoice-added':
        event.type = 'invoice-created'
        this.push(event)
        break

      case 'ticket-added':
        event.type = 'ticket-created'
        this.push(event)
        break

     default:
        this.push(event)
    }
    callback()
  }
}
