module.exports = function () {
  const invoices = {}
  const customers = {}
  const persons = {}

  return {
    handleEvent(event, assert) {
      switch (event.type) {
        case 'person-created':
          assert(event.person, 'No person in event')
          assert(event.person.id, 'No person id in event')
          assert(!persons[event.person.id], 'Person already exists')
          persons[event.person.id] = event.person
          break

        case 'person-updated':
          assert(event.person, 'No person in event')
          assert(event.person.id, 'No person id in event')
          assert(persons[event.person.id], 'Person doesn\'t exist')
          persons[event.person.id] = {...persons[event.person.id], ...event.person}
          break

        case 'customer-created':
          assert(event.customer, 'No customer in event')
          assert(event.customer.id, 'No customer id in event')
          assert(!customers[event.customer.id], 'Customer already exists')
          const customer = {...event.customer}
          customer.person = persons[event.customer.personId]
          delete customer.personId
          customers[event.customer.id] = customer
          break

        case 'customer-updated':
          assert(event.customer, 'No customer in event')
          assert(event.customer.id, 'No customer id in event')
          assert(customers[event.customer.id], 'Customer doesn\'t exist')
          customers[event.customer.id] = {...customers[event.customer.id], ...event.customer}
          break

        case 'invoice-created':
          assert(event.invoice, 'No invoice in event')
          assert(event.invoice.id, 'No invoice id in event')
          assert(!invoices[event.invoice.id], 'Invoice already exists')
          assert(customers[event.invoice.customerId], 'Customer doesn\'t exist')
          const invoice = {...event.invoice}
          invoice.customer = customers[invoice.customerId]
          delete invoice.customerId
          invoice.tickets = []
          invoices[event.invoice.id] = invoice
          break

        case 'invoice-updated':
          assert(event.invoice, 'No invoice in event')
          assert(event.invoice.id, 'No invoice id in event')
          assert(invoices[event.invoice.id], 'Invoice doesn\'t exist')
          invoices[event.invoice.id] = {...invoices[event.invoice.id], ...event.invoice}
          break

        case 'invoice-deleted':
          assert(event.invoiceId, 'No invoiceId in event')
          assert(invoices[event.invoiceId], 'Invoice doesn\'t exist')
          delete invoices[event.invoiceId]
          break

        case 'ticket-created':
          assert(invoices[event.ticket.invoiceId], 'Invoice doesn\'t exist')
          invoices[event.ticket.invoiceId].tickets.push({
            participant: event.ticket.personId && persons[event.ticket.personId]
          })
          break

        case 'payment-received':
          assert(event.invoiceId, 'No invoiceId specified')
          assert(invoices[event.invoiceId], 'Invoice doesn\'t exist')
          invoices[event.invoiceId].paid = true
          break

        case 'payment-withdrawn':
          assert(event.invoiceId, 'No invoiceId specified')
          assert(invoices[event.invoiceId], 'Invoice doesn\'t exist')
          invoices[event.invoiceId].paid = false
          break

      }
    },

    getAll() {
      return Object.values(invoices)
    },

    getByUserId(id) {
      return invoices[id]
    }
  }
}
