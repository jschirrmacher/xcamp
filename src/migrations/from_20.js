const stream = require('stream')

const customer2person = {}

module.exports = class From_20 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    switch (event.type) {
      case 'customer-created':
        customer2person[event.customer.id] = event.customer.personId
        break

      case 'newsletter-approved':
        if (customer2person[event.personId]) {
          event.personId = customer2person[event.personId]
        }
        break

      case 'topic-linked':
        if (customer2person[event.nodeId]) {
          event.nodeId = customer2person[event.nodeId]
        }
        break
    }
    this.push(event)
    callback()
  }
}
