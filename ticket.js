const rack = require('hat').rack(128, 36)

module.exports = (dgraphClient, dgraph, Customer, Person, payment) => {
  async function getInvoice(txn, uid) {
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
        name
        email
        addresses {
          address
          postcode
          city
          country
        }
      }
      tickets {
        access_code
      }
    }}`
    const result = await txn.query(query)
    const invoice = result.getJson().invoice
    return invoice.length ? invoice[0] : Promise.reject('Invoice not found')
  }

  async function getLastInvoice(txn, customerId) {
    const result = await txn.query(`{customer(func: uid("${customerId}")){uid invoices {uid}}}`)
    const customer = result.getJson().customer[0]
    const invoice = customer.invoices
    return invoice.length ? getInvoice(txn, invoice[0].uid) : Promise.reject('Invoice not found')
  }

  async function createInvoice(txn, data, customer) {
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
    const res = await txn.mutate(muCustomer)

    return getInvoice(txn, uid)
  }

  async function buy(data, origin) {
    if (!data.tos_accepted) {
      return Promise.reject({status: 403, message: 'You need to accept the terms of service'})
    } else if (data.reduced && data.payment === 'invoice') {
      return Promise.reject({status: 403, message: 'Reduced tickets are available only when paying immediately'})
    }

    const txn = dgraphClient.newTxn()
    const customer = await Customer.create(txn, data)
    const invoice = await createInvoice(txn, data, customer)
    txn.commit()
    const accountUrl = origin + '/accounts/' + customer.access_code
    return {
      isRedirection: true,
      url: invoice.payment ? accountUrl : payment(origin).exec(customer, invoice, true)
    }
  }

  return {buy, getLastInvoice}
}
