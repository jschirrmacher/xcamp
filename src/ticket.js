const templateGenerator = require('./TemplateGenerator')
const mailSender = require('./mailSender')

module.exports = (dgraphClient, dgraph, Customer, Person, Invoice, Payment, QueryFunction) => {
  const query = QueryFunction('Ticket', `
    uid
    access_code
    participant {
      uid
      firstName
      lastName
      email
    }
  `)

  async function buy(data, baeUrl) {
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

      const accountUrl = baeUrl + 'accounts/' + customer.access_code + '/info'

      const person = customer.person[0]
      const html = templateGenerator.generate('invoice-mail', {customer, person, url: accountUrl})
      const subject = 'XCamp Ticketbuchung'
      mailSender.send(person.email, subject, html)
      const ticketCount = invoice.tickets.length
      mailSender.send('xcamp@justso.de', subject, templateGenerator.generate('booking-mail', {customer, person, ticketCount}))

      return {
        isRedirection: true,
        url: invoice.payment === 'invoice' ? accountUrl : Payment(baeUrl).exec(customer, invoice, process.env.NODE_ENV !== 'production')
      }
    } finally {
      txn.discard()
    }
  }

  async function get(txn, uid) {
    return query.one(txn, `func: uid(${uid}`)
  }

  async function findByAccessCode(txn, accessCode) {
    return query.one(txn, `func: eq(access_code, "${accessCode}")`)
  }

  async function setCustomerAsParticipant(ticketCode, accountCode) {
    const txn = dgraphClient.newTxn()
    try {
      const customer = await Customer.findByAccessCode(txn, accountCode)
      const ticket = await findByAccessCode(txn, ticketCode)
      const person = customer.person[0]

      const mu = new dgraph.Mutation()
      await mu.setSetNquads(`<${ticket.uid}> <participant> <${person.uid}> .`)
      await txn.mutate(mu)

      txn.commit()
      return {}
    } finally {
      txn.discard()
    }
  }

  async function setParticipant(ticketCode, data) {
    const txn = dgraphClient.newTxn()
    try {
      const ticket = await findByAccessCode(txn, ticketCode)
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
      }
      txn.commit()
      return {}
    } finally {
      txn.discard()
    }
  }

  async function checkin(ticketCode, baseUrl) {
    const txn = dgraphClient.newTxn()
    try {
      const ticket = await findByAccessCode(txn, ticketCode)
      return {
        isRedirection: true,
        url: baseUrl + 'tickets/' + ticketCode + '/show'
      }
    } finally {
      txn.discard()
    }
  }

  return {buy, setParticipant, setCustomerAsParticipant, findByAccessCode, checkin}
}
