module.exports = (Model, mailSender, templateGenerator, Payment, mailChimp, rack, store, readModels, config) => {
  function redirectTo(url, user) {
    return {isRedirection: true, url, user}
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
    } catch (error) {
      throw new Error('Fehler beim Eintragen in den Newsletter: ' + error.content.detail)
    }

    try {
      await mailChimp.addTags(person, [config.eventName])
    } catch (error) {
      // Tag might already be set to the person, so just ignore
    }
  }

  async function buy(data) {
    if (!data.tos_accepted) {
      throw {status: 403, message: 'You need to accept the terms of service'}
    } else if (data.type !== 'corporate' && data.payment === 'invoice') {
      throw {status: 403, message: 'Reduced tickets are available only when paying immediately'}
    }

    try {
      if (data.code) {
        assertCoupon(data.code, data.type)
      }
      data.ticketCount = +data.ticketCount // eslint-disable-line require-atomic-updates
      const customer = await Model.Customer.create(data)
      const invoice = await Model.Invoice.create(data, customer)

      await addSubscriber(data)

      if (data.code) {
        store.add({type: 'coupon-invalidated', code: data.code})
      }

      let url
      if (invoice.payment === 'paypal') {
        url = Payment.getPaymentURL(customer, invoice)
      } else {
        url = config.baseUrl + 'accounts/' + customer.access_code + '/info'
      }
      return redirectTo(url)
    } catch (e) {
      throw {status: 500, message: '' + (e.message || e.toString())}
    }
  }

  async function setParticipant(accessCode, data, user) {
    const ticket = readModels.invoice.getTicketByAccessCode(accessCode)
    const person = await Model.Person.getOrCreate(data, user)
    if (!ticket.participant || ticket.participant.id !== person.id) {
      store.add({type: 'participant-set', ticketId: ticket.id, personId: person.id})

      await mailChimp.addSubscriber(person)
      await mailChimp.addTags(person, [config.eventName])

      const url = config.baseUrl + 'accounts/' + ticket.access_code + '/info'
      const html = templateGenerator.generate('mail/ticket-mail', {url})
      return mailSender.send(person.email, 'XCamp Ticket', html)
    }
    return {}
  }

  function show(accessCode) {
    readModels.user.findByAccessCode(accessCode)
    return {
      isRedirection: true,
      url: config.baseUrl + 'tickets/' + accessCode + '/show'
    }
  }

  async function checkin(accessCode) {
    const ticket = readModels.user.findByAccessCode(accessCode)
    const person = readModels.person.getById(ticket.participant[0].id)
    const result = {ok: true, id: person.id, name: person.name, image: person.image}
    if (!ticket.checkedIn) {
      store.add({type: 'checkin', ticketId: ticket.id})
    } else {
      result.ok = false
      result.message = 'Already checked in!'
    }
    return result
  }

  function createCoupon(user, category = 'reduced') {
    const access_code = rack()
    store.add({type: 'coupon-created', access_code, category, generated_by: user.id})
    const link = config.baseUrl + 'tickets?code=' + access_code
    return {type: 'coupon', link}
  }

  return {buy, setParticipant, show, checkin, createCoupon}
}
