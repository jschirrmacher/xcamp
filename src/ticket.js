module.exports = (dgraphClient, dgraph, Model, mailSender, templateGenerator, Payment, mailChimp, rack, store, readModels, config) => {
  function redirectTo(url, user) {
    return {isRedirection: true, url, user}
  }

  function create(person, count) {
    return Array.from({length: count}, () => ({
      type: 'ticket',
      access_code: rack(),
      participant: {uid: person.uid}
    }))
  }

  function assertCoupon(code, type) {
    const coupon = readModels.coupon.getByAccessCode(code)
    if (!coupon) {
      throw 'Reduced tickets require a valid coupon code'
    }
    if (coupon.category !== type) {
      throw `Ticket category doesn't match coupon code`
    }
  }

  async function addSubscriber(person) {
    try {
      await mailChimp.addSubscriber(person)
      await mailChimp.addTags(person, [config.eventName])
    } catch (error) {
      throw new Error(error.content.detail)
    }
  }

  async function buy(data) {
    if (!data.tos_accepted) {
      return Promise.reject({status: 403, message: 'You need to accept the terms of service'})
    } else if (data.type !== 'corporate' && data.payment === 'invoice') {
      return Promise.reject({status: 403, message: 'Reduced tickets are available only when paying immediately'})
    }

    const txn = dgraphClient.newTxn()
    try {
      if (data.code) {
        assertCoupon(data.code, data.type)
      }
      const customer = await Model.Customer.create(txn, data)
      const person = customer.person[0]
      const tickets = create(person, +data.ticketCount)
      const invoice = await Model.Invoice.create(data, customer)
      tickets.forEach(ticket => Model.Invoice.addTicket(invoice, ticket))

      await addSubscriber(person)

      txn.commit()
      if (data.code) {
        store.add({type: 'coupon-invalidated', code: data.code})
      }

      let url
      if (invoice.payment === 'paypal') {
        url = Payment.getPaymentURL(customer, invoice)
      } else {
        url = config.baseUrl + 'accounts/' + customer.access_code + '/info'
      }
      return redirectTo(url, readModels.user.getById(customer.uid))
    } finally {
      txn.discard()
    }
  }

  async function setParticipant(txn, accessCode, data, user) {
    const ticket = readModels.invoice.getTicketByAccessCode(accessCode)
    const person = await Model.Person.getOrCreate(txn, data, user, false)

    if (!ticket.participant || ticket.participant.id !== person.uid) {
      if (ticket.participant) {
        const uid = ticket.participant.id
        const mu = new dgraph.Mutation()
        await mu.setDelNquads(`<${ticket.id}> <participant> <${uid}> .`)
        await txn.mutate(mu)
      }
      const mu = new dgraph.Mutation()
      await mu.setSetNquads(`<${ticket.id}> <participant> <${person.uid}> .`)
      await txn.mutate(mu)
      store.add({type: 'participant-set', ticketId: ticket.id, personId: person.uid})

      await mailChimp.addSubscriber(person)
      await mailChimp.addTags(person, [config.eventName])

      const url = config.baseUrl + 'accounts/' + ticket.access_code + '/info'
      const html = templateGenerator.generate('ticket-mail', {url})
      return mailSender.send(person.email, 'XCamp Ticket', html)
    }
    return {}
  }

  async function show(accessCode) {
    const txn = dgraphClient.newTxn()
    try {
      await findByAccessCode(txn, accessCode)
      return {
        isRedirection: true,
        url: config.baseUrl + 'tickets/' + accessCode + '/show'
      }
    } finally {
      txn.discard()
    }
  }

  async function checkin(txn, accessCode) {
    const ticket = await findByAccessCode(txn, accessCode)
    const person = await Model.Person.get(txn, ticket.participant[0].uid)
    const result = {ok: true, uid: person.uid, name: person.name, image: person.image}
    if (!ticket.checkedIn) {
      const mu = new dgraph.Mutation()
      await mu.setSetNquads(`<${ticket.uid}> <checkedIn> "1" .`)
      await txn.mutate(mu)
      store.add({type: 'checkin', ticketId: ticket.uid})
    } else {
      result.ok = false
      result.message = 'Already checked in!'
    }
    return result
  }

  async function createCoupon(txn, user, category = 'reduced') {
    const mu = new dgraph.Mutation()
    const access_code = rack()
    mu.setSetJson({type: 'coupon', access_code, category})
    const assigned = await txn.mutate(mu)
    store.add({type: 'coupon-created', access_code, category, generated_by: user.id})
    const link = config.baseUrl + 'tickets?code=' + access_code
    return {type: 'coupon', uid: assigned.getUidsMap().get('blank-0'), link}
  }

  return {create, buy, setParticipant, show, checkin, createCoupon}
}
