'use strict'

const ticketTypes = require('./ticketTypes')

module.exports = (store, readModels) => {
  function create(data, customer) {
    if (typeof ticketTypes[data.type] === 'undefined') {
      throw 'Unknown ticket type'
    }

    const invoice = {
      id: readModels.invoice.getLastInvoiceId() + 1,
      invoiceNo: data.payment === 'invoice' ? readModels.invoice.getMaxInvoiceNo() + 1 : 0,
      created: new Date().toISOString(),
      customerId: customer.uid,
      ticketType: data.type,
      ticketPrice: ticketTypes[data.type].price,
      payment: data.payment,
      tickets: []
    }
    store.add({type: 'invoice-created', invoice})
    return invoice
  }

  function addTicket(invoice, ticket) {
    ticket.id = readModels.invoice.getLastTicketId() + 1
    store.add({type: 'ticket-created', ticket: {
      id: ticket.id,
      access_code: ticket.access_code,
      personId: ticket.participant.uid,
      invoiceId: invoice.id
    }})
  }

  return {create, addTicket}
}
