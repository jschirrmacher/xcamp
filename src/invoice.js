'use strict'

module.exports = (store, readModels, config, rack) => {
  const ticketTypes = require('./ticketTypes')(config)

  function create(data, customer) {
    if (typeof ticketTypes[data.type] === 'undefined') {
      throw 'Unknown ticket type'
    }

    const id = readModels.invoice.getLastInvoiceId() + 1
    let ticketId = readModels.invoice.getLastTicketId() + 1

    const invoice = {
      id,
      invoiceNo: data.payment === 'invoice' ? readModels.invoice.getMaxInvoiceNo() + 1 : 0,
      created: new Date().toISOString(),
      customerId: customer.id,
      ticketType: data.type,
      ticketPrice: ticketTypes[data.type].price,
      payment: data.payment,
      ticketCount: data.ticketCount,
      tickets: []
    }
    store.add({type: 'invoice-created', invoice})
    Array.from({length: data.ticketCount}, async () => {
      await store.add({type: 'ticket-created', ticket: {
        id: ticketId++,
        access_code: rack(),
        personId: customer.personId,
        invoiceId: id
      }})
    })
    return invoice
  }

  return {create}
}
