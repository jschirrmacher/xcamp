const Formatter = require('../lib/Formatter')

const countries = {
  de: 'Deutschland',
  ch: 'Schweiz',
  at: 'Österreich'
}

let maxInvoiceNo = 0
let lastInvoiceId = 0
let lastTicketId = 0

module.exports = function ({models, config}) {
  const invoices = {}
  const customers = {}
  const tickets = {}
  const ticketTypes = require('../ticketTypes')(config)

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
    dependencies: ['user'],

    handleEvent(event, assert) {
      function createCustomer(customerData) {
        assert(customerData, 'No customer in event')
        assert(customerData.id, 'No customer id in event')
        assert(!customers[customerData.id], 'Customer already exists')
        const customer = {...customerData}
        customer.person = models.person.getById(customerData.personId)
        delete customer.personId
        customers[customerData.id] = customer
      }

      function createInvoice(invoiceData) {
        assert(invoiceData, 'No invoice in event')
        assert(invoiceData.id, 'No invoice id in event')
        assert(!invoices[invoiceData.id], 'Invoice already exists')
        assert(customers[invoiceData.customerId], 'Customer doesn\'t exist')
        lastInvoiceId = invoiceData.id
        const invoice = {...invoiceData}
        const customer = {...customers[invoice.customerId]}
        customer.person = {...customer.person}
        invoice.customer = customer
        delete invoice.customerId
        invoice.tickets = []
        if (invoice.payment === 'none') {
          invoice.paid = true
        }
        invoices[invoiceData.id] = invoice
        maxInvoiceNo = Math.max(invoices[event.invoice.id].invoiceNo, maxInvoiceNo)
      }

      function setParticipant(participantId, ticketId) {
        const person = models.person.getById(participantId)
        assert(person, 'Referenced person not found')

        Object.values(invoices).find(invoice => {
          return invoice.tickets.find(ticket => {
            const ticketFound = ticket.id === ticketId
            if (ticketFound) {
              ticket.participant = person
            }
            return ticketFound
          })
        })
      }

      function createTicket(ticket) {
        assert(invoices[ticket.invoiceId], 'Invoice doesn\'t exist')
        assert(ticket.id, 'No ticket id specified')
        assert(!tickets[ticket.id], 'Ticket already exist')
        lastTicketId = Math.max(lastTicketId, ticket.id)
        if (ticket.personId) {
          ticket.participant = models.person.getById(ticket.personId)
        }
        tickets[ticket.id] = ticket
        invoices[ticket.invoiceId].tickets.push(ticket)
      }

      switch (event.type) {
        case 'customer-created':
          createCustomer(event.customer)
          break

        case 'customer-updated':
          assert(event.customer, 'No customer in event')
          assert(event.customer.id, 'No customer id in event')
          assert(customers[event.customer.id], 'Customer doesn\'t exist')
          customers[event.customer.id] = Object.assign(customers[event.customer.id], event.customer)
          break

        case 'invoice-created':
          createInvoice(event.invoice)
          break

        case 'invoice-updated':
          assert(event.invoice, 'No invoice in event')
          assert(event.invoice.id, 'No invoice id in event')
          assert(invoices[event.invoice.id], 'Invoice doesn\'t exist')
          invoices[event.invoice.id] = Object.assign(invoices[event.invoice.id], event.invoice)
          maxInvoiceNo = Math.max(invoices[event.invoice.id].invoiceNo, maxInvoiceNo)
          break

        case 'invoice-deleted':
          assert(event.invoiceId, 'No invoiceId in event')
          assert(invoices[event.invoiceId], 'Invoice doesn\'t exist')
          delete invoices[event.invoiceId]
          break

        case 'ticket-created':
          createTicket(event.ticket)
          break

        case 'participant-set':
          assert(event.ticketId, 'No ticketId specified')
          assert(event.personId, 'No personId specified')
          setParticipant(event.personId, event.ticketId)
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
        yourReference: invoice.customer.yourReference,
        firstName: invoice.customer.person.firstName,
        lastName: invoice.customer.person.lastName,
        address: invoice.customer.address,
        postcode: invoice.customer.postcode,
        city: invoice.customer.city,
        country: countries[invoice.customer.country],
        paid: invoice.paid
      })
    },

    getTicketByAccessCode(code) {
      return this.getAll()
        .filter(invoice => invoice.payment !== 'paypal' || invoice.paid)
        .map(invoice => invoice.tickets.find(ticket => ticket.access_code === code))
        .filter(ticket => ticket)
        .shift()
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
    },

    getMaxInvoiceNo() {
      return maxInvoiceNo
    },

    getLastInvoiceId() {
      return lastInvoiceId
    },

    getLastTicketId() {
      return lastTicketId
    }
  }
}
