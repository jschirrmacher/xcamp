'use strict'

const ticketTypes = require('./ticketTypes')
const select = require('./lib/select')

module.exports = (dgraphClient, dgraph, Model, store) => {
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
        uid
        firm
        access_code
        person {
          uid
          firstName
          lastName
          email
        }
        addresses {
          uid
          address
          postcode
          city
          country
        }
      }
      tickets {
        uid
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
    return invoice && invoice.length ? get(txn, invoice[0].uid) : Promise.reject('Invoice not found')
  }

  async function getNextInvoiceNo(txn) {
    const result = await txn.query(`{ var(func: eq(type, "invoice")) { d as invoiceNo } me() {max(val(d))}}`)
    return result.getJson().me[0]['max(val(d))'] + 1
  }

  async function create(txn, data, customer, tickets) {
    if (typeof ticketTypes[data.type] === 'undefined') {
      throw 'Unknown ticket type'
    }
    const invoiceNo = (!ticketTypes[data.type].price || data.payment === 'paypal') ? 0 : await getNextInvoiceNo(txn)

    const invoiceData = {
      type: 'invoice',
      invoiceNo,
      created: '' + new Date(),
      customer: {uid: customer.uid},
      tickets,
      ticketType: data.type,
      ticketPrice: ticketTypes[data.type].price,
      payment: data.payment,
      isAdmin: data.type === 'orga' ? 1 : undefined
    }

    const mu = new dgraph.Mutation()
    mu.setSetJson(invoiceData)
    const assigned = await txn.mutate(mu)
    const invoiceId = assigned.getUidsMap().get('blank-0')

    const muCustomer = new dgraph.Mutation()
    await muCustomer.setSetNquads(`<${customer.uid}> <invoices> <${invoiceId}> .`)
    await txn.mutate(muCustomer)

    const result = await get(txn, invoiceId)

    const invoice = select(invoiceData, ['invoiceNo', 'created', 'ticketType', 'ticketPrice', 'payment'])
    invoice.id = invoiceId
    invoice.customerId = customer.uid
    invoice.created = new Date(invoice.created).toISOString()
    store.add({type: 'invoice-created', invoice})

    result.tickets.forEach(t => {
      store.add({type: 'ticket-created', ticket: {id: t.id, access_code: t.access_code, personId: t.participant.uid, invoiceId}})
    })

    return result
  }

  async function addTicket(txn, invoice, ticket) {
    const mu = new dgraph.Mutation()
    await mu.setSetJson(ticket)
    const assigned = await txn.mutate(mu)
    const uid = assigned.getUidsMap().get('blank-0')

    const mu2 = new dgraph.Mutation()
    await mu2.setSetNquads(`<${invoice.uid}> <tickets> <${uid}> .`)
    await txn.mutate(mu2)
  }

  async function deleteInvoice(txn, invoiceId) {
    const unique = (value, index, self) => self.indexOf(value) === index
    const invoice = await get(txn, invoiceId)
    const customer = invoice.customer[0]
    const addresses = customer.addresses
    const person = customer.person[0]
    const tickets = invoice.tickets
    const participants = tickets.map(ticket => ticket.participant)
    const toDelete = [invoice, ...addresses, person, ...tickets, ...participants]
    const uids = toDelete.map(o => o && o.uid).filter(o => o).filter(unique)
    const mu = new dgraph.Mutation()
    mu.setDelNquads(uids.map(uid => '<' + uid + '> * * .').join('\n'))
    await txn.mutate(mu)

    store.add({type: 'invoice-deleted', invoiceId})
  }

  async function paid(txn, invoiceId, state) {
    const invoice = await get(txn, invoiceId)
    if (state && invoice.payment === 'paypal') {
      await Model.Payment.paymentReceived(txn, invoice)
    } else {
      const mu = new dgraph.Mutation()
      if (state) {
        mu.setSetNquads(`<${invoiceId}> <paid> "1" .`)
        store.add({type: 'payment-received', invoiceId})
      } else {
        mu.setDelNquads(`<${invoiceId}> <paid> * .`)
        store.add({type: 'payment-withdrawn', invoiceId})
      }
      await txn.mutate(mu)
    }
  }

  return {get, getNewest, getNextInvoiceNo, create, deleteInvoice, addTicket, paid}
}
