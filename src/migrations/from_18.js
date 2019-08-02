const stream = require('stream')

let invoiceId = 0
const mapping = {}

module.exports = class From_17 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    switch (event.type) {
      case 'invoice-created':
        mapping[event.invoice.id] = ++invoiceId
        event.invoice.id = invoiceId
        break

      case 'invoice-updated':
        event.invoice.id = mapping[event.invoice.id]
        break

      case 'ticket-created':
        event.ticket.invoiceId = mapping[event.ticket.invoiceId]
        break

      case 'invoice-deleted':
      case 'payment-received':
      case 'payment-withdrawn':
        event.invoiceId = mapping[event.invoiceId]
        break

      case 'paypal-payment-received':
        event.info.custom = mapping[event.info.custom]
        break

    }
    this.push(event)
    callback()
  }
}
