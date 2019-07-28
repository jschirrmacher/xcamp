'use strict'

const ticketTypes = require('./ticketTypes')

module.exports = (store, readModels) => {
  function create(data, customer, tickets) {
    if (typeof ticketTypes[data.type] === 'undefined') {
      throw 'Unknown ticket type'
    }

    const invoice = {
      id: readModels.invoice.getLastInvoiceId() + 1,
      invoiceNo: 0,
      created: new Date().toISOString(),
      customerId: customer.uid,
      ticketType: data.type,
      ticketPrice: ticketTypes[data.type].price,
      payment: data.payment
    }
    store.add({type: 'invoice-created', invoice})
    invoice.tickets = []
    tickets.forEach(ticket => addTicket(invoice, ticket))
    return invoice
  }

  function addTicket(invoice, ticket) {
    ticket.id = readModels.invoice.getLastTicketId() + 1
    ticket.invoiceId = invoice.id
    store.add({type: 'ticket-created', ticket})
  }

  return {create, addTicket}
}
