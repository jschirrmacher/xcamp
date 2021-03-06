const stream = require('stream')

module.exports = class From_5 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    function handleCustomerAdded() {
      event.type = 'customer-created'
      const person = event.customer.person
      delete event.customer.person
      event.customer.personId = person.id
      this.push({ts: event.ts, type: 'person-created', person})
    }

    switch (event.type) {
      case 'customer-added':
        handleCustomerAdded()
        break

      case 'invoice-added':
        event.type = 'invoice-created'
        break

      case 'ticket-added':
        event.type = 'ticket-created'
        break

    }
    this.push(event)
    callback()
  }
}
