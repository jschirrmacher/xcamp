const ticketTypes = require('../ticketTypes')
const Formatter = require('../lib/Formatter')

const countries = {
  de: 'Deutschland',
  ch: 'Schweiz',
  at: 'Österreich'
}

module.exports = function () {
  const invoices = {}
  const customers = {}
  const persons = {}

  function extractTickets(tickets) {
    return invoice => invoice.tickets.forEach(ticket => {
      const person = ticket.participant
      tickets.push({
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        firm: invoice.customer.firm
      })
    })
  }

  return {
    handleEvent(event, assert) {
      function createCustomer(customerData) {
        assert(customerData, 'No customer in event')
        assert(customerData.id, 'No customer id in event')
        assert(!customers[customerData.id], 'Customer already exists')
        const customer = {...customerData}
        customer.person = persons[customerData.personId]
        delete customer.personId
        customers[customerData.id] = customer
      }

      function createInvoice(invoiceData) {
        assert(invoiceData, 'No invoice in event')
        assert(invoiceData.id, 'No invoice id in event')
        assert(!invoices[invoiceData.id], 'Invoice already exists')
        assert(customers[invoiceData.customerId], 'Customer doesn\'t exist')
        const invoice = {...invoiceData}
        invoice.customer = customers[invoice.customerId]
        delete invoice.customerId
        invoice.tickets = []
        invoices[invoiceData.id] = invoice
      }

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
          createCustomer(event.customer)
          break

        case 'customer-updated':
          assert(event.customer, 'No customer in event')
          assert(event.customer.id, 'No customer id in event')
          assert(customers[event.customer.id], 'Customer doesn\'t exist')
          customers[event.customer.id] = {...customers[event.customer.id], ...event.customer}
          break

        case 'invoice-created':
          createInvoice(event.invoice)
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
            id: event.ticket.id,
            access_code: event.ticket.access_code,
            participant: event.ticket.personId && persons[event.ticket.personId]
          })
          break

        case 'participant-set':
          assert(event.ticketId, 'No ticketId specified')
          assert(event.personId, 'No personId specified')
          const participant = persons[event.personId]
          assert(participant, 'Referenced person not found')
          Object.values(invoices).find(invoice => {
            return invoice.tickets.find(ticket => {
              const ticketFound = ticket.id === event.ticketId
              if (ticketFound) {
                ticket.participant = participant
              }
              return ticketFound
            })
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

    getById(id) {
      return invoices[id]
    },

    getByCustomerId(id) {
      return Object.values(invoices)
        .filter(invoice => invoice.customer.id === id)
        .sort((a, b) => b.invoiceNo - a.invoiceNo)
    },

    getPrintableInvoiceData(invoice, baseUrl) {
      const ticketCount = invoice.tickets.length
      const netAmount = ticketCount * invoice.ticketPrice
      const vat = 0.19 * netAmount
      const created = new Date(invoice.created)
      return Object.assign({baseUrl}, invoice, {
        created: Formatter.date(created),
        ticketType: ticketTypes[invoice.ticketType].name,
        ticketString: ticketCount + ' Ticket' + (ticketCount === 1 ? '' : 's'),
        bookedString: ticketCount === 1 ? 'das gebuchte Ticket' : 'die gebuchten Tickets',
        netAmount: Formatter.currency(netAmount),
        vat: Formatter.currency(vat),
        totalAmount: Formatter.currency(vat + netAmount),
        firm: invoice.customer.firm,
        firstName: invoice.customer.person.firstName,
        lastName: invoice.customer.person.lastName,
        address: invoice.customer.address,
        postcode: invoice.customer.postcode,
        city: invoice.customer.city,
        country: countries[invoice.customer.country],
        paid: invoice.paid
      })
    },

    getAllTickets() {
      const tickets = []
      this.getAll()
        .filter(invoice => invoice.payment !== 'paypal' || invoice.paid)
        .forEach(extractTickets(tickets))
      return tickets
    },

    getTicketsForCustomer(id) {
      const tickets = []
      this.getAll()
        .filter(invoice => invoice.customer.id === id)
        .forEach(extractTickets(tickets))
      return tickets
    }
  }
}
