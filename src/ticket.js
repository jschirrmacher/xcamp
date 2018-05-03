
module.exports = (dgraphClient, dgraph, Customer, Person, Invoice, Payment, QueryFunction) => {
  const query = QueryFunction('Ticket', `
    id: uid
    access_code
    participant {
      firstName
      lastName
      email
    }
  `)

  async function buy(data, origin) {
    if (!data.tos_accepted) {
      return Promise.reject({status: 403, message: 'You need to accept the terms of service'})
    } else if (data.reduced && data.payment === 'invoice') {
      return Promise.reject({status: 403, message: 'Reduced tickets are available only when paying immediately'})
    }

    const txn = dgraphClient.newTxn()
    try {
      const customer = await Customer.create(txn, data)
      const invoice = await Invoice.create(txn, data, customer)
      txn.commit()

      const accountUrl = origin + '/accounts/' + customer.access_code + '/info'
      return {
        isRedirection: true,
        url: invoice.payment ? accountUrl : Payment(origin).exec(customer, invoice, true)
      }
    } finally {
      txn.discard()
    }
  }

  async function get(txn, id) {
    return query(txn, `func: uid(${id}`)
  }

  async function findByAccessCode(txn, accessCode) {
    return query(txn, `func: eq(access_code, "${accessCode}")`)
  }

  async function setCustomerAsParticipant(ticketCode, accountCode) {
    const txn = dgraphClient.newTxn()
    try {
      const customer = await Customer.findByAccessCode(txn, accountCode)
      const ticket = await findByAccessCode(txn, ticketCode)
      const person = customer.person[0]

      const mu = new dgraph.Mutation()
      await mu.setSetNquads(`<${ticket.id}> <participant> <${person.id}> .`)
      await txn.mutate(mu)

      txn.commit()
    } finally {
      txn.discard()
    }
  }

  async function setParticipant(ticketCode, data) {
    throw {status: 500, message: 'not yet implemented'}
  }

  return {buy, setParticipant, setCustomerAsParticipant}
}
