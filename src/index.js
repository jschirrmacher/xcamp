const fs = require('fs')
const path = require('path')
const Mustache = require('mustache')
const dgraph = require('dgraph-js')
const grpc = require('grpc')
const nodemailer = require('nodemailer')
const url = require('url')

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

const clientStub = new dgraph.DgraphClientStub('localhost:9080', grpc.credentials.createInsecure())
const dgraphClient = new dgraph.DgraphClient(clientStub)

const express = require('express')
const bodyParser = require('body-parser')
const app = express()
app.set('json spaces', 2)

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

const rack = require('hat').rack(128, 36)
const QueryFunction = require('./QueryFunction')
const Person = require('./person')(dgraphClient, dgraph, QueryFunction)
const Customer = require('./customer')(dgraphClient, dgraph, QueryFunction, rack)
const Network = require('./network')(dgraphClient, dgraph)
const Invoice = require('./invoice')(dgraphClient, dgraph, rack)
const Ticket = require('./ticket')(dgraphClient, dgraph, Customer, Person, Invoice, require('./payment'), QueryFunction)

const isProduction = process.env.NODE_ENV === 'production'

app.use((req, res, next) => {
  console.log(req.method, req.path)
  next()
})

async function exec(func, res, type = 'json') {
  return func
    .catch(error => {
      res.status(error.status || 500)
      error = error.toString() + (isProduction ? '' : ('\n' + error.stack))
      console.error(error)
      return type === 'json' ? {error} : error
    })
    .then(result => {
      if (result && result.isRedirection) {
        res.redirect(result.url)
      } else {
        res[type](result)
      }
    })
}

async function doInTransaction(action, params, commit = false) {
  const txn = dgraphClient.newTxn()
  params = Array.isArray(params) ? params : [params]
  try {
    const result = await action.apply(global, [txn, ...params])
    if (commit) {
      txn.commit()
    }
    return result
  } finally {
    txn.discard()
  }
}

app.use('/', express.static(path.join(__dirname, '/../public')))
app.use('/js-netvis', express.static(path.join(__dirname, '/../node_modules/js-netvis/dist')))
app.use('/qrcode', express.static(path.join(__dirname, '/../node_modules/qrcode/build')))

app.post('/persons', (req, res) => exec(doInTransaction(Person.upsert, [{}, req.body], true), res))
app.get('/persons/:uid', (req, res) => exec(doInTransaction(Person.get, req.params.uid), res))

app.post('/tickets', (req, res) => exec(Ticket.buy(req.body, req.headers.origin), res))
app.put('/tickets/:ticketCode/accounts/:customerCode', (req, res) => {
  exec(Ticket.setCustomerAsParticipant(req.params.ticketCode, req.params.customerCode), res)
})
app.put('/tickets/:ticketCode', (req, res) => exec(Ticket.setParticipant(req.params.ticketCode, req.body), res))
app.get('/tickets/:ticketCode/show', (req, res) => exec(doInTransaction(getTicket, req.params.ticketCode, 'show'), res, 'send'))
app.get('/tickets/:ticketCode/print', (req, res) => exec(doInTransaction(getTicket, req.params.ticketCode, 'print'), res, 'send'))
app.get('/tickets/:ticketCode/send', (req, res) => exec(doInTransaction(sendTicket, [req.params.ticketCode, req.headers.referer]), res))

app.post('/accounts', (req, res) => res.status(500).json({error: 'not yet implemented'}))   // register as community user without ticket
app.put('/accounts/:accessCode', (req, res) => res.status(500).json({error: 'not yet implemented'}))
app.get('/accounts/:accessCode', (req, res) => exec(getAccountInfo(req.params.accessCode), res, 'send'))
app.get('/accounts/:accessCode/info', (req, res) => exec(doInTransaction(getAccountInfoPage, req.params.accessCode), res, 'send'))
app.get('/accounts/:accessCode/invoices/current', (req, res) => exec(doInTransaction(getLastInvoice, req.params.accessCode), res, 'send'))

app.get('/network', (req, res) => exec(Network.getGraph(), res))
app.delete('/network', (req, res) => exec(Network.rebuild(), res))

const port = 8001
app.listen(port, () => console.log('Running on port ' + port))

function getTemplate(name) {
  return '' + fs.readFileSync(path.join(__dirname, '/../templates/' + name + '.mustache'))
}

const subTemplates = {
  ticketHeader: getTemplate('ticket-header'),
  ticketData: getTemplate('ticket-data'),
}

async function getAccountInfoPage(txn, accessCode) {
  const customer = await Customer.findByAccessCode(txn, accessCode)
  const invoice = await Invoice.getNewest(txn, customer.uid)
  return Mustache.render(getTemplate('account-info'), {accessCode, tickets: invoice.tickets}, subTemplates)
}

async function getLastInvoice(txn, accessCode) {
  const customer = await Customer.findByAccessCode(txn, accessCode)
  const invoice = await Invoice.getNewest(txn, customer.uid)
  return Invoice.getInvoiceAsHTML(invoice, getTemplate('invoice'))
}

async function getTicket(txn, accessCode, mode) {
  const ticket = await Ticket.findByAccessCode(txn, accessCode)
  return Mustache.render(getTemplate('ticket'), {mode, disabled: 'disabled', participant: ticket.participant[0]}, subTemplates)
}

async function sendTicket(txn, accessCode, origin) {
  const ticket = await Ticket.findByAccessCode(txn, accessCode)
  return new Promise(function (resolve, reject) {
    const base= url.parse(origin)
    const baseUrl = base.protocol + '//' + base.host
    transporter.sendMail({
      from: 'XCamp Tickets <tickets@justso.de>',
      to: ticket.participant[0].email,
      subject: 'XCamp Ticket',
      html: Mustache.render(getTemplate('ticket-mail'), {url: baseUrl + '/tickets/' + accessCode + '/show'})
    }, (err, info) => {
      if (err) {
        reject(err)
      } else {
        resolve(info)
      }
    })
  })
}
