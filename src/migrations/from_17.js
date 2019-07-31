const stream = require('stream')

let ticketNo = 0
let invoiceNo = 0
const mapping = {}
const invoices = {}

module.exports = class From_17 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    switch (event.type) {
      case 'ticket-created':
        mapping[event.ticket.id] = ++ticketNo
        event.ticket.id = ticketNo
        break

      case 'participant-set':
        event.ticketId = mapping[event.ticketId]
        break

      case 'invoice-created':
        if (event.invoice.payment === 'invoice') {
          if (event.invoice.invoiceNo && event.invoice.invoiceNo !== invoiceNo + 1) {
            throw 'Unexpected invoice number'
          }
          event.invoice.invoiceNo = ++invoiceNo
        }
        invoices[event.invoice.id] = event.invoice
        invoiceNo = Math.max(invoiceNo, event.invoice.invoiceNo)
        break

      case 'invoice-updated':
        if (!invoices[event.invoice.id]) {
          throw 'Unknown invoice'
        }
        if (!Object.keys(event.invoice).some(key => event.invoice[key] !== invoices[event.invoice.id][key])) {
          callback()
          return
        }
        invoices[event.invoice.id] = Object.assign(invoices[event.invoice.id], event.invoice)
        invoiceNo = Math.max(invoiceNo, event.invoice.invoiceNo)
        break
    }
    this.push(event)
    callback()
  }
}
