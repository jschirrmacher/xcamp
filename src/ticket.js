module.exports = (dgraphClient, dgraph, Model, QueryFunction, mailSender, templateGenerator, mailChimp, rack, store, config) => {
  const query = QueryFunction('Ticket', `
    uid
    type
    access_code
    checkedIn
    participant {
      uid
      firstName
      lastName
      email
      image
    }`
  )

  function redirectTo(url, user) {
    return {isRedirection: true, url, user}
  }

  async function create(txn, person, count) {
    return Array.from({length: count}, () => ({
      type: 'ticket',
      access_code: rack(),
      participant: {uid: person.uid}
    }))
  }

  async function assertCoupon(txn, code) {
    if (!code) {
      throw 'Reduced tickets require a coupon code'
    }
    const result = await txn.query(`{ coupons(func: eq(type, "coupon")) @filter(eq(access_code, "${code}")) { uid }}`)
    const coupons = result.getJson().coupons
    if (!coupons.length) {
      throw 'Reduced tickets are available only with a valid coupon code'
    }

    const mu = new dgraph.Mutation()
    mu.setDelNquads(`<${coupons[0].uid}> * * .`)
    await txn.mutate(mu)

    store.add({type: 'coupon-invalidated', code})
  }

  async function buy(data) {
    if (!data.tos_accepted) {
      return Promise.reject({status: 403, message: 'You need to accept the terms of service'})
    } else if (data.type !== 'corporate' && data.payment === 'invoice') {
      return Promise.reject({status: 403, message: 'Reduced tickets are available only when paying immediately'})
    }

    const txn = dgraphClient.newTxn()
    try {
      if (data.type === 'reduced') {
        await assertCoupon(txn, data.code)
      }
      const customer = await Model.Customer.create(txn, data)
      const tickets = await create(txn, customer.person[0], +data.ticketCount)
      const invoice = await Model.Invoice.create(txn, data, customer, tickets)

      await mailChimp.addSubscriber(customer)
      await mailChimp.addTags(customer.person[0].email, [config.eventName])

      txn.commit()

      let url
      if (invoice.payment === 'invoice') {
        url = mailSender.sendTicketNotifications(customer, invoice)
      } else {
        url = Model.Payment.exec(customer, invoice)
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

  async function setParticipant(txn, accessCode, data, user) {
    const ticket = await findByAccessCode(txn, accessCode)
    const person = await Model.Person.getOrCreate(txn, data, user, false)

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
      store.add({type: 'participant-set', ticketId: ticket.uid, personId: person.uid})

      await mailChimp.addSubscriber({person: [person]})
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
      const ticket = await findByAccessCode(txn, accessCode)
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

  async function createCoupon(txn, user) {
    const mu = new dgraph.Mutation()
    const access_code = rack()
    mu.setSetJson({type: 'coupon', access_code})
    const assigned = await txn.mutate(mu)
    store.add({type: 'coupon-created', access_code, generated_by: user.uid})
    const link = config.baseUrl + 'tickets?code=' + access_code
    return {type: 'coupon', uid: assigned.getUidsMap().get('blank-0'), link}
  }

  return {get, create, buy, setParticipant, findByAccessCode, show, checkin, createCoupon}
}
