const Mustache = require('mustache')

const countries = {
  de: 'Deutschland',
  ch: 'Schweiz',
  at: 'Österreich'
}

const dateFormat = {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
}

const currencyFormatter = new Intl.NumberFormat('de-DE', {style: 'currency', currency: 'EUR'})

module.exports = (dgraphClient, dgraph, rack) => {
  function getInvoiceAsHTML(invoice, template) {
    const netAmount = invoice.tickets.length * invoice.ticketPrice
    const vat = 0.19 * netAmount
    const data = Object.assign({}, invoice, {
      created: (new Date(invoice.created)).toLocaleDateString('de-DE', dateFormat),
      ticketType: invoice.ticketType === 'corporate' ? 'Unternehmen' : 'Privatperson / Einzelunternehmer',
      ticketString: 'Ticket' + (invoice.ticketCount === 1 ? '' : 's'),
      bookedString: invoice.ticketCount === 1 ? 'das gebuchte' : 'die gebuchten',
      netAmount: currencyFormatter.format(netAmount),
      vat: currencyFormatter.format(vat),
      totalAmount: currencyFormatter.format(vat + netAmount),
      customer: invoice.customer[0],
      address: invoice.customer[0].addresses[0],
    })
    data.customer.firstName = data.customer.person[0].firstName
    data.customer.lastName = data.customer.person[0].lastName
    data.address.country = countries[data.address.country]

    return Mustache.render(template, data)
  }

  async function get(txn, uid) {
    const query = `{ invoice(func: uid(${uid})) {
      id: uid
      invoiceNo
      created
      ticketType
      ticketPrice
      payment
      reduced
      customer {
        firm
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

  async function create(txn, data, customer) {
    const result = await txn.query(`{ var(func: eq(type, "invoice")) { d as invoiceNo } me() {max(val(d))}}`)
    const invoiceNo = result.getJson().me[0]['max(val(d))'] + 1
    const invoice = {
      type: 'invoice',
      invoiceNo,
      created: '' + new Date(),
      customer,
      ticketType: data.type,
      ticketPrice: data.reduced ? 100 : 200,
      payment: data.payment,
      reduced: data.reduced
    }
    invoice.tickets = Array.from({length: data.ticketCount}, () => ({
      type: 'ticket',
      access_code: rack()
    }))

    const mu = new dgraph.Mutation()
    mu.setSetJson(invoice)
    const assigned = await txn.mutate(mu)
    const uid = assigned.getUidsMap().get('blank-0')

    const muCustomer = new dgraph.Mutation()
    await muCustomer.setSetNquads(`<${customer.id}> <invoices> <${uid}> .`)
    await txn.mutate(muCustomer)

    return get(txn, uid)
  }

  return {
    getInvoiceAsHTML, getNewest, create
  }
}
