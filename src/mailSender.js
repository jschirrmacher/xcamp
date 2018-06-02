'use strict'

const from = 'XCamp Tickets <tickets@justso.de>'

module.exports = (baseUrl, isProduction, nodemailer, templateGenerator) => {
  function send(to, subject, html) {
    return new Promise((resolve, reject) => {
      transporter.sendMail({from, to, subject, html}, (err, info) => err ? reject(err) : resolve(info))
    })
  }

  function sendTicketNotifications(customer, invoice) {
    const url = baseUrl + 'accounts/' + customer.access_code + '/info'
    const person = customer.person[0]
    const ticketCount = invoice.tickets.length
    const subject = 'XCamp Ticketbuchung'
    const params = {customer, person, baseUrl, url, ticketCount}
    send(person.email, subject, templateGenerator.generate('invoice-mail', params))
    send('xcamp@justso.de', subject, templateGenerator.generate('booking-mail', params))
    return url
  }

  let transporter
  if (!isProduction) {
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'mhkbznbggjrcoqr5@ethereal.email',
        pass: 'bwvnMfNUu7Zj9auBGe'
      }
    })
  } else {
    transporter = nodemailer.createTransport({
      sendmail: true,
      newline: 'unix',
      path: '/usr/sbin/sendmail'
    })
  }

  return {send, sendTicketNotifications}
}
