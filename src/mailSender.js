'use strict'

const ticketTypes = require('./ticketTypes')

module.exports = (dgraph, nodemailer, templateGenerator, config, rack) => {
  function send(to, subject, html) {
    return new Promise((resolve, reject) => {
      transporter.sendMail({from: config['mail-sender'], to, subject, html}, (err, info) => err ? reject(err) : resolve(info))
    })
  }

  function sendTicketNotifications(customer, invoice) {
    const url = config.baseUrl + 'accounts/' + customer.access_code + '/info'
    const person = customer.person[0]
    const ticketCount = invoice.tickets.length
    const subject = 'XCamp Ticketbuchung'
    const params = {customer, person, url, ticketCount, ticketType: ticketTypes[invoice.ticketType].name}
    send(person.email, subject, templateGenerator.generate('invoice-mail', params))
    send(config['mail-recipients']['ticket-sold'], subject, templateGenerator.generate('booking-mail', params))
    return url
  }

  async function sendHashMail(txn, templateName, customer, action, subject = 'XCamp Passwort') {
    const hash = rack()
    const mu = new dgraph.Mutation()
    await mu.setSetNquads(`<${customer.uid}> <hash> "${hash}" .`)
    await txn.mutate(mu)

    const link = config.baseUrl + action + '/' + hash
    const firstName = customer.person[0].firstName
    const html = templateGenerator.generate(templateName, {link, customer, firstName})
    const to = customer.person[0].email
    send(to, subject, html)
    return hash
  }

  const transporter = nodemailer.createTransport(config.mailTransport)
  return {send, sendTicketNotifications, sendHashMail}
}
