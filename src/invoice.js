'use strict'

const ticketTypes = require('./ticketTypes')

const countries = {
  de: 'Deutschland',
  ch: 'Schweiz',
  at: 'Österreich'
}

const leadingZero = num => ('0' + num).substr(-2)
const currency = n => n.toFixed(0).replace(/(\d)(?=(\d{3})+)/g, '$1.') + ',' + leadingZero(n.toFixed(2).slice(2)) + ' €'

module.exports = (dgraphClient, dgraph) => {
  function getPrintableInvoiceData(invoice, baseUrl) {
    const ticketCount = invoice.tickets.length
    const netAmount = ticketCount * invoice.ticketPrice
    const vat = 0.19 * netAmount
    const created = new Date(invoice.created)
    const data = Object.assign({baseUrl}, invoice, {
      created: leadingZero(created.getDate()) + '.' + leadingZero(created.getMonth()+1) + '.' + created.getFullYear(),
      ticketType: ticketTypes[invoice.ticketType].name,
      ticketString: ticketCount + ' Ticket' + (ticketCount === 1 ? '' : 's'),
      bookedString: ticketCount === 1 ? 'das gebuchte Ticket' : 'die gebuchten Tickets',
      netAmount: currency(netAmount),
      vat: currency(vat),
      totalAmount: currency(vat + netAmount),
      customer: invoice.customer[0],
      address: invoice.customer[0].addresses[0],
      paid: invoice.paid
    })
    data.customer.firstName = data.customer.person[0].firstName
    data.customer.lastName = data.customer.person[0].lastName
    data.address.country = countries[data.address.country]

    return data
  }

  async function get(txn, uid) {
    const query = `{ invoice(func: uid(${uid})) {
      uid
      invoiceNo
      created
      ticketType
      ticketPrice
      payment
      paid
      customer {
        firm
        access_code
        person {
          firstName
          lastName
          email
        }
        addresses {
          address
          postcode
          city
          country
        }
      }
      tickets {
        access_code
        participant {
          uid
          firstName
          lastName
          email
        }
      }
    }}`
    const result = await txn.query(query)
    const invoices = result.getJson().invoice
    const invoice = invoices.length ? invoices[0] : Promise.reject('Invoice not found')
    invoice.tickets.forEach(ticket => {
      ticket.participant = ticket.participant && ticket.participant.length && ticket.participant[0]
      ticket.isPersonalized = !!ticket.participant
    })
    return invoice
  }

  async function getNewest(txn, customerId) {
    const result = await txn.query(`{customer(func: uid("${customerId}")){uid invoices {uid}}}`)
    const customer = result.getJson().customer[0]
    const invoice = customer.invoices
    return invoice.length ? get(txn, invoice[0].uid) : Promise.reject('Invoice not found')
  }

  async function getNextInvoiceNo(txn) {
    const result = await txn.query(`{ var(func: eq(type, "invoice")) { d as invoiceNo } me() {max(val(d))}}`)
    return result.getJson().me[0]['max(val(d))'] + 1
  }

  async function create(txn, data, customer, tickets) {
    if (typeof ticketTypes[data.type] === 'undefined') {
      throw 'Unknown ticket type'
    }
    const invoice = {
      type: 'invoice',
      invoiceNo: data.type === 'orga' ? 0 : getNextInvoiceNo(txn),
      created: '' + new Date(),
      customer,
      tickets,
      ticketType: data.type,
      ticketPrice: ticketTypes[data.type].price,
      payment: data.payment
    }

    const mu = new dgraph.Mutation()
    mu.setSetJson(invoice)
    const assigned = await txn.mutate(mu)
    const uid = assigned.getUidsMap().get('blank-0')

    const muCustomer = new dgraph.Mutation()
    await muCustomer.setSetNquads(`<${customer.uid}> <invoices> <${uid}> .`)
    await txn.mutate(muCustomer)

    return get(txn, uid)
  }

  return {
    get, getPrintableInvoiceData, getNewest, create
  }
}
