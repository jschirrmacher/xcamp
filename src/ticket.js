module.exports = (dgraphClient, dgraph, Customer, Person, Invoice, Payment, QueryFunction, mailSender, templateGenerator) => {
  const query = QueryFunction('Ticket', `
    uid
    access_code
    participant {
      uid
      firstName
      lastName
      email
    }`
  )

  function redirectTo(url, user) {
    return {isRedirection: true, url, user}
  }

  async function buy(data, baseUrl) {
    if (!data.tos_accepted) {
      return Promise.reject({status: 403, message: 'You need to accept the terms of service'})
    } else if (data.type !== 'corporate' && data.payment === 'invoice') {
      return Promise.reject({status: 403, message: 'Reduced tickets are available only when paying immediately'})
    }

    const txn = dgraphClient.newTxn()
    try {
      const customer = await Customer.create(txn, data)
      const invoice = await Invoice.create(txn, data, customer)
      txn.commit()

      let url
      if (invoice.payment === 'invoice') {
        url = mailSender.sendTicketNotifications(customer, invoice)
      } else {
        url = Payment.exec(customer, invoice)
      }
      return redirectTo(url, customer)
    } finally {
      txn.discard()
    }
  }

  async function get(txn, uid) {
    return query.one(txn, `func: uid(${uid})`)
  }

  async function findByAccessCode(txn, accessCode) {
    return query.one(txn, `func: eq(access_code, "${accessCode}")`)
  }

  async function setParticipant(accessCode, data, baseUrl, subTemplates) {
    const txn = dgraphClient.newTxn()
    try {
      const ticket = await findByAccessCode(txn, accessCode)
      const person = await Person.getOrCreate(txn, data)

      if (!ticket.participant || ticket.participant[0].uid !== person.uid) {
        if (ticket.participant) {
          const uid = ticket.participant[0].uid
          const mu = new dgraph.Mutation()
          await mu.setDelNquads(`<${ticket.uid}> <participant> <${uid}> .`)
          await txn.mutate(mu)
        }
        const mu = new dgraph.Mutation()
        await mu.setSetNquads(`<${ticket.uid}> <participant> <${person.uid}> .`)
        await txn.mutate(mu)
        txn.commit()

        const url = baseUrl + 'accounts/' + ticket.access_code + '/info'
        const html = templateGenerator.generate('ticket-mail', {url, baseUrl}, subTemplates)
        return mailSender.send(person.email, 'XCamp Ticket', html)
      }
      return {}
    } catch (error) {
      throw error
    } finally {
      txn.discard()
    }
  }

  async function checkin(accessCode, baseUrl) {
    const txn = dgraphClient.newTxn()
    try {
      const ticket = await findByAccessCode(txn, accessCode)
      return {
        isRedirection: true,
        url: baseUrl + 'tickets/' + accessCode + '/show'
      }
    } finally {
      txn.discard()
    }
  }

  return {get, buy, setParticipant, findByAccessCode, checkin}
}
