'use strict'

const nodemailer = require('nodemailer')

const from = 'XCamp Tickets <tickets@justso.de>'

let transporter
if (process.env.NODE_ENV !== 'production') {
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

module.exports = {
  send: (to, subject, html) => new Promise(function (resolve, reject) {
    transporter.sendMail({from, to, subject, html}, (err, info) => err ? reject(err) : resolve(info))
  })
}
