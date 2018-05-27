'use strict'

const nodemailer = require('nodemailer')

const from = 'XCamp Tickets <tickets@justso.de>'

module.exports = isProduction => {
  function send(to, subject, html) {
    return new Promise((resolve, reject) => {
      transporter.sendMail({from, to, subject, html}, (err, info) => err ? reject(err) : resolve(info))
    })
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

  return {send}
}
