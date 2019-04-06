'use strict'

const ticketTypes = require('./ticketTypes')

module.exports = (dgraph, baseUrl, isProduction, nodemailer, templateGenerator, config, rack) => {
  function send(to, subject, html) {
    return new Promise((resolve, reject) => {
      transporter.sendMail({from: config['mail-sender'], to, subject, html}, (err, info) => err ? reject(err) : resolve(info))
    })
  }

  function sendTicketNotifications(customer, invoice) {
    const url = baseUrl + 'accounts/' + customer.access_code + '/info'
    const person = customer.person[0]
    const ticketCount = invoice.tickets.length
    const subject = 'XCamp Ticketbuchung'
    const params = {customer, person, url, ticketCount, ticketType: ticketTypes[invoice.ticketType].name}
    send(person.email, subject, templateGenerator.generate('invoice-mail', params))
    send(config['mail-recipients']['ticket-sold'], subject, templateGenerator.generate('booking-mail', params))
    return url
  }

  let transporter
  if (!isProduction) {
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PWD
      }
    })
  } else {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 25,
      ignoreTLS: true,
      secure: false,
      debug: true,
      newline: 'unix'
    })
  }

  async function sendHashMail(txn, templateName, customer, action, subject = 'XCamp Passwort') {
    const hash = rack()
    const mu = new dgraph.Mutation()
    await mu.setSetNquads(`<${customer.uid}> <hash> "${hash}" .`)
    await txn.mutate(mu)

    const link = baseUrl + action + '/' + hash
    const firstName = customer.person[0].firstName
    const html = templateGenerator.generate(templateName, {link, customer, firstName})
    const to = customer.person[0].email
    send(to, subject, html)
    return hash
  }

  return {send, sendTicketNotifications, sendHashMail}
}
