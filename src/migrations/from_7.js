const stream = require('stream')

module.exports = class From_7 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    switch (event.type) {
      case 'customer-added':
        event.type = 'customer-created'
        if (event.customer.person) {
          this.push({ts: event.ts, type: 'person-created', person: event.customer.person})
          event.customer.personId = event.customer.person.id
          delete event.customer.person
        }
        break

      case 'invoice-added':
        event.type = 'invoice-created'
        break

      case 'ticket-added':
        event.type = 'ticket-created'
        break

      case 'payment-received':
        this.push({ts: event.ts, type: 'invoice-updated', invoice: {id: event.invoiceId, invoiceNo: event.invoiceNo}})
        delete event.invoiceNo
        break

    }
    this.push(event)
    callback()
  }
}
