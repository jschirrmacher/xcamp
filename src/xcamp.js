const nodeenv = process.env.NODE_ENV || 'develop'
const isProduction = nodeenv === 'production'
const port = process.env.PORT || 8001
const baseUrl = process.env.BASEURL
const AUTH_SECRET = process.env.AUTH_SECRET
const DGRAPH_URL = process.env.DGRAPH_URL || 'localhost:9080'
const logger = console

const path = require('path')
const config = require(path.resolve(__dirname, '..', 'config', 'config.json'))
global.fetch = require('node-fetch')
const fetch = require('js-easy-fetch')()
const dgraph = require('dgraph-js')
const grpc = require('grpc')
const templateGenerator = require('./TemplateGenerator')
const nodemailer = require('nodemailer')
const mailSender = require('./mailSender')(baseUrl, isProduction, nodemailer, templateGenerator)

const clientStub = new dgraph.DgraphClientStub(DGRAPH_URL, grpc.credentials.createInsecure())
const dgraphClient = new dgraph.DgraphClient(clientStub)

const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const multer = require('multer')
const upload = multer({dest: path.resolve(__dirname , '..', 'profile-pictures')})
const app = express()
app.set('json spaces', 2)

app.use((req, res, next) => {
  next()
  logger.info(new Date(), req.method + ' ' + req.path, req.headers['user-agent'])
})

app.use(cookieParser())
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

const EventStore = require('./EventStore')
const store = new EventStore({basePath: path.resolve('./store'), logger})
const readModels = require('./readModels')(store)

const rack = require('hat').rack(128, 36)
const QueryFunction = require('./QueryFunction')
const User = require('./user')(dgraphClient, QueryFunction, store)
const Topic = require('./topic')(dgraphClient, dgraph, QueryFunction, store)
const Person = require('./person')(dgraphClient, dgraph, QueryFunction, Topic, store)
const Customer = require('./customer')(dgraphClient, dgraph, QueryFunction, rack, store)
const Network = require('./network')(dgraphClient, dgraph, Person, Topic, store)
const Invoice = require('./invoice')(dgraphClient, dgraph, store)
const Payment = require('./payment')(dgraphClient, dgraph, Invoice, fetch, baseUrl, mailSender, !isProduction, store)
const Ticket = require('./ticket')(dgraphClient, dgraph, Customer, Person, Invoice, Payment, QueryFunction, mailSender, templateGenerator, rack, store)

function getLoginUrl(req) {
  return baseUrl + 'login/' + encodeURIComponent(req.params.accessCode) + '/' + encodeURIComponent(encodeURIComponent(req.originalUrl))
}

const auth = require('./auth')(app, Person, Customer, Ticket, User, dgraphClient, dgraph, AUTH_SECRET, getLoginUrl, store)
const redirect = true
const allowAnonymous = true
const requireCodeOrAuth = (options = {}) => auth.authenticate(['jwt', 'access_code'], options)
const requireCodeAndHash = (options = {}) => auth.authenticate('codeNHash', options)
const requireJWT = (options = {}) => auth.authenticate('jwt', options)
const requireLogin = (options = {}) => auth.authenticate('login', options)

function requireAdmin(req, res, next) {
  if ((!req.user || !req.user.isAdmin) && readModels.user.adminIsDefined) {
    throw {status: 403, message: 'Not allowed'}
  } else {
    next()
  }
}

function makeHandler(func, type = 'json') {
  return async function (req, res, next) {
    try {
      const result = await func(req)
      if (result && result.isRedirection) {
        if (result.user) {
          auth.signIn({user: result.user}, res)
        }
        res.redirect(result.url)
      } else if (result && result.mimeType) {
        res.contentType(result.mimeType)
        if (result.disposition) {
          const name = result.name ? '; filename="' + result.name + '"' : ''
          res.header('Content-Disposition', result.disposition + name)
        }
        res.send(result.content)
      } else {
        res[type](result)
      }
    } catch (error) {
      next(error)
    }
  }
}

async function doInTransaction(action, params = [], commit = false) {
  const txn = dgraphClient.newTxn()
  params = Array.isArray(params) ? params : [params]
  try {
    const result = await action.apply(global, [txn, ...params])
    if (commit) {
      txn.commit()
    }
    return result
  } catch (error) {
    throw error
  } finally {
    txn.discard()
  }
}

function sendUserInfo() {
  return (req, res) => res.json({
    loggedIn: !!req.user,
    hasPasswordSet: req.user && !!req.user.password,
    access_code: req.user && req.user.access_code
  })
}

app.use('/', express.static(path.join(__dirname, '/../public')))
app.use('/js-netvis', express.static(path.join(__dirname, '/../node_modules/js-netvis')))

app.use('/qrcode', express.static(path.join(__dirname, '/../node_modules/qrcode/build')))

app.post('/login', requireLogin(), (req, res) => res.json({token: auth.signIn(req, res)}))
app.get('/login', requireJWT({allowAnonymous}), sendUserInfo())
app.get('/login/:accessCode/:url', makeHandler(req => loginPage(req.params.accessCode, req.params.url), 'send'))

app.post('/persons', requireJWT(), makeHandler(req => doInTransaction(Person.upsert, [{}, req.body, req.user], true)))
app.get('/persons/:uid', requireJWT({allowAnonymous}), makeHandler(req => doInTransaction(Person.getPublicDetails, [req.params.uid, req.user])))
app.put('/persons/:uid', requireJWT(), makeHandler(req => doInTransaction(Person.updateById, [req.params.uid, req.body, req.user], true)))
app.put('/persons/:uid/picture', requireJWT(), upload.single('picture'), makeHandler(req => doInTransaction(Person.uploadProfilePicture, [req.params.uid, req.file, req.user], true)))
app.get('/persons/:uid/picture/:name', makeHandler(req => doInTransaction(Person.getProfilePicture, req.params.uid), 'send'))

app.get('/topics', makeHandler(req => doInTransaction(Topic.find, [req.query.q])))
app.put('/topics/:uid', requireJWT(), makeHandler(req => doInTransaction(Topic.updateById, [req.params.uid, req.body, req.user], true)))

app.get('/tickets', requireJWT({allowAnonymous}), makeHandler(req => getTicketPage(req.query.code, req.user && req.user.isAdmin), 'send'))
app.post('/tickets', makeHandler(req => Ticket.buy(req.body, baseUrl)))
app.get('/tickets/:accessCode', requireCodeOrAuth({redirect}), makeHandler(req => Ticket.show(req.params.accessCode, baseUrl)))
app.put('/tickets/:accessCode', requireJWT(), makeHandler(req => Ticket.setParticipant(req.params.accessCode, req.body, baseUrl, subTemplates, req.user)))
app.get('/tickets/:accessCode/show', requireCodeOrAuth({redirect}), makeHandler(req => doInTransaction(getTicket, [req.params.accessCode, 'show']), 'send'))
app.get('/tickets/:accessCode/print', requireCodeOrAuth({redirect}), makeHandler(req => doInTransaction(getTicket, [req.params.accessCode, 'print']), 'send'))
app.get('/tickets/:accessCode/checkin', requireJWT(), requireAdmin, makeHandler(req => doInTransaction(Ticket.checkin, [req.params.accessCode], true)))

app.get('/accounts/my', requireJWT({redirect}), (req, res) => res.redirect(getAccountInfoURL(req.user)))
app.get('/accounts/:accessCode/info', requireCodeOrAuth({redirect}), makeHandler(req => doInTransaction(getAccountInfoPage, req.params.accessCode), 'send'))
app.get('/accounts/:accessCode/password', makeHandler(req => doInTransaction(sendPassword, req.params.accessCode, true), 'send'))
app.post('/accounts/password', requireJWT(), makeHandler(req => doInTransaction(setPassword, [req.user, req.body.password], true)))
app.get('/accounts/:accessCode/password/reset', requireJWT({redirect}), makeHandler(req => resetPassword(req.params.accessCode), 'send'))
app.get('/accounts/:accessCode/password/reset/:hash', requireCodeAndHash({redirect}), makeHandler(req => resetPassword(req.params.accessCode), 'send'))
app.get('/accounts/:accessCode/invoices/current', requireCodeOrAuth({redirect}), makeHandler(req => doInTransaction(getLastInvoice, req.params.accessCode), 'send'))
app.post('/accounts/:accessCode/tickets', requireJWT(), requireAdmin, makeHandler(req => doInTransaction(createAdditionalTicket, [req.params.accessCode], true)))

app.get('/paypal/ipn', (req, res) => res.redirect('/accounts/my', 303))
app.post('/paypal/ipn', (req, res) => res.send(Payment.paypalIpn(req)))

app.get('/network', requireJWT({allowAnonymous}), makeHandler(req => Network.getGraph(req.query.what, req.user)))
app.delete('/network', requireJWT(), requireAdmin, makeHandler(req => Network.rebuild()))

app.post('/orga', requireJWT({allowAnonymous}), requireAdmin, makeHandler(req => doInTransaction(createOrgaMember, [req.body], true)))
app.post('/orga/coupon', requireJWT(), requireAdmin, makeHandler(req => doInTransaction(createCoupon, [], true)))
app.get('/orga/participants', requireJWT({redirect}), requireAdmin, makeHandler(req => doInTransaction(exportParticipants, req.query.format || 'txt'), 'send'))
app.get('/orga/invoices', requireJWT({redirect}), requireAdmin, makeHandler(req => doInTransaction(listInvoices), 'send'))
app.put('/orga/invoices/:invoiceNo/paid', requireJWT(), requireAdmin, makeHandler(req => doInTransaction(invoicePayment, [req.params.invoiceNo, true], true)))
app.delete('/orga/invoices/:invoiceNo/paid', requireJWT(), requireAdmin, makeHandler(req => doInTransaction(invoicePayment, [req.params.invoiceNo, false], true)))
app.delete('/orga/invoices/:invoiceNo', requireJWT(), requireAdmin, makeHandler(req => doInTransaction(Invoice.deleteInvoice, [req.params.invoiceNo, true], true)))
app.get('/orga/checkin', requireJWT({redirect}), requireAdmin, makeHandler(req => checkinApp(), 'send'))
app.get('/orga/tiles', requireJWT(), requireAdmin, makeHandler(req => generateTile(req.query), 'send'))

app.use((err, req, res, next) => {
  res.status(err.status || 500)
  logger.error(new Date(), err.stack || err)
  const message = err.message || err.toString()
  res.send(isProduction ? message : err.stack || message)
})

app.listen(port, () => logger.info('Running on port ' + port +
  ' in ' + nodeenv + ' mode' +
  ' with baseURL=' + baseUrl +
  (Payment.useSandbox ? ' using sandbox' : ' using PayPal')
))

const subTemplates = ['ticketHeader', 'ticketData', 'menu', 'logo', 'footer']

async function loginPage(accessCode, url) {
  return templateGenerator.generate('login-page', {url, baseUrl, accessCode}, subTemplates)
}

async function getTicketPage(code, isAdmin) {
  const templateName = config.ticketSaleStarted || isAdmin ? 'buy-ticket' : 'no-tickets-yet'
  const categories = Object.keys(config.ticketCategories).map(c => `${c}: ${config.ticketCategories[c]}`).join(',')
  const data = {baseUrl, code, eventName: config.eventName, categories}
  return templateGenerator.generate(templateName, data, subTemplates)
}

function getAccountInfoURL(user) {
  return baseUrl + 'accounts/' + user.access_code + '/info'
}

async function getAccountInfoPage(txn, accessCode) {
  const user = await User.findByAccessCode(txn, accessCode)
  const customer = user.type === 'customer' ? await Customer.get(txn, user.uid) : null
  let invoice = customer ? await Invoice.getNewest(txn, customer.uid) : null
  let tickets
  if (user.type === 'ticket') {
    const ticket = await Ticket.get(txn, user.uid)
    ticket.participant = ticket.participant[0]
    ticket.isPersonalized = true
    tickets = [ticket]
  } else {
    tickets = invoice.tickets
  }
  const paid = invoice && invoice.paid
  const password = !!user.password
  invoice = invoice && invoice.invoiceNo ? invoice : null
  return templateGenerator.generate('account-info', {
    invoice,
    accessCode,
    password,
    paid,
    tickets,
    baseUrl,
    config
  }, subTemplates)
}

async function getLastInvoice(txn, accessCode) {
  const customer = await Customer.findByAccessCode(txn, accessCode)
  const invoice = await Invoice.getNewest(txn, customer.uid)
  return templateGenerator.generate('invoice', Invoice.getPrintableInvoiceData(invoice, baseUrl), subTemplates)
}

async function getTicket(txn, accessCode, mode) {
  const ticket = await Ticket.findByAccessCode(txn, accessCode)
  const disabled = mode === 'print' ? 'disabled' : ''
  const print = mode === 'print'
  const params = {mode, print, disabled, access_code: accessCode, participant: ticket.participant[0], baseUrl}
  return templateGenerator.generate('ticket', params, subTemplates)
}

async function sendHashMail(txn, templateName, customer) {
  const hash = rack()
  const mu = new dgraph.Mutation()
  await mu.setSetNquads(`<${customer.uid}> <hash> "${hash}" .`)
  await txn.mutate(mu)

  const link = baseUrl + 'accounts/' + customer.access_code + '/password/reset/' + hash
  const html = templateGenerator.generate(templateName, {baseUrl, link})
  const subject = 'XCamp Passwort'
  const to = customer.person[0].email
  mailSender.send(to, subject, html)
  store.add({type: 'set-mail-hash', userId: customer.uid, hash})
}

async function sendPassword(txn, accessCode) {
  const method = accessCode.match(/^.*@.*\.\w+$/) ? 'findByEMail' : 'findByAccessCode'
  const customer = await Customer[method](txn, accessCode)
  sendHashMail(txn,'sendPassword-mail', customer)
  return templateGenerator.generate('password-sent', {baseUrl}, subTemplates)
}

async function resetPassword(accessCode) {
  return templateGenerator.generate('password-reset-form', {accessCode, baseUrl}, subTemplates)
}

async function checkinApp() {
  return templateGenerator.generate('checkinApp', {baseUrl}, subTemplates)
}

async function setPassword(txn, user, password) {
  const result = await auth.setPassword(txn, user.access_code, password)
  result.userId = Network.getNodeId(user)
  return result
}

async function createOrgaMember(txn, data) {
  data.payment = 'none'
  const customer = await Customer.create(txn, data)
  const tickets = await Ticket.create(txn, customer.person[0], data.ticketCount || 1)
  await Invoice.create(txn, data, customer, tickets)
  sendHashMail(txn, 'send-free-ticket-mail', customer)
}

async function createCoupon(txn) {
  const mu = new dgraph.Mutation()
  const access_code = rack()
  mu.setSetJson({type: 'coupon', access_code})
  const assigned = await txn.mutate(mu)
  store.add({type: 'coupon-created', access_code})
  return {type: 'coupon', uid: assigned.getUidsMap().get('blank-0'), link: baseUrl + 'tickets?code=' + access_code}
}

async function createAdditionalTicket(txn, accessCode) {
  const customer = await Customer.findByAccessCode(txn, accessCode)
  const tickets = await Ticket.create(txn, customer.person[0], 1)
  return Invoice.addTicket(txn, customer.invoices[0], tickets[0])
}

async function listInvoices(txn) {
  let participantCount = 0
  let paidTickets = 0
  let totals = 0
  const paymentType = {
    paypal: 'PayPal',
    invoice: 'Rechnung',
    none: 'N/A'
  }
  const invoices = await Invoice.listAll(txn)
  invoices.forEach(invoice => {
    if (!invoice.customer) {
      throw 'No customer defined for invoice: ' + JSON.stringify(invoice)
    }
    if (!invoice.customer[0].person) {
      throw 'No person defined for customer: ' + JSON.stringify(invoice)
    }
    invoice.customer = invoice.customer[0]
    invoice.customer.person = invoice.customer.person[0]
    invoice.created = Invoice.getFormattedDate(new Date(invoice.created))
    invoice.payment = invoice.paid ? paymentType[invoice.payment] : 'Offen'
    invoice.participants = invoice.tickets.filter(ticket => ticket.participant).map(ticket => {
      const participant = ticket.participant[0]
      participant.checkedIn = ticket.checkedIn ? 'checked' : ''
      return participant
    })
    participantCount += invoice.tickets.length
    if (invoice.paid) {
      paidTickets += invoice.tickets.length
      totals += invoice.tickets.length * invoice.ticketPrice
    }
    invoice.paid = invoice.paid ? 'paid' : 'open'
  })
  return templateGenerator.generate('invoices-list', {
    invoices,
    baseUrl,
    participantCount,
    paidTickets,
    totals
  }, subTemplates)
}

async function invoicePayment(txn, invoiceId, state) {
  const invoice = await Invoice.get(txn, invoiceId)
  if (state && invoice.payment === 'paypal') {
    await Payment.paymentReceived(txn, invoice)
  } else {
    const mu = new dgraph.Mutation()
    if (state) {
      mu.setSetNquads(`<${invoiceId}> <paid> "1" .`)
    } else {
      mu.setDelNquads(`<${invoiceId}> <paid> * .`)
    }
    await txn.mutate(mu)
  }
}

async function generateTile(data) {
  const colorSelect = () => value => {
    const flags = {};
    ['yellow', 'turquoise', 'red', 'grey', 'tuatara'].forEach(color => {
      flags['is_' + color] = color === data[value] ? 'selected' : ''
    })
    return templateGenerator.generate('colorOptions', flags)
  }
  return templateGenerator.generate('tile-form', {baseUrl, colorSelect, ...data}, subTemplates)
}

async function exportParticipants(txn, format) {
  const tickets = await Network.getAllTickets(txn)
  const content = tickets.map(ticket => {
    const person = ticket.participant[0]
    if (format === 'excel') {
      return `"${person.firstName}";"${person.lastName}";"${person.email}";"${ticket.firm}"`
    } else if (format === 'csv') {
      return `"${person.firstName}","${person.lastName}","${person.email}","${ticket.firm}"`
    } else {
      return person.firstName + ' ' + person.lastName + ' &lt;' + person.email + '&gt; ' + ticket.firm
    }
  }).join('\n')

  if (format === 'csv' || format === 'excel') {
    return {
      mimeType: 'application/x-ms-excel',
      disposition: 'attachment',
      name: 'participants.csv',
      content
    }
  } else {
    return content.replace(/\n/g, '<br>\n')
  }
}
