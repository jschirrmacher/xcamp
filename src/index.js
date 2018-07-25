const nodeenv = process.env.NODE_ENV || 'develop'
const isProduction = nodeenv === 'production'
const port = process.env.PORT || 8001
const baseUrl = process.env.BASEURL
const AUTH_SECRET = process.env.AUTH_SECRET

const path = require('path')
global.fetch = require('node-fetch')
const fetch = require('js-easy-fetch')()
const dgraph = require('dgraph-js')
const grpc = require('grpc')
const templateGenerator = require('./TemplateGenerator')
const nodemailer = require('nodemailer')
const mailSender = require('./mailSender')(baseUrl, isProduction, nodemailer, templateGenerator)

const clientStub = new dgraph.DgraphClientStub('localhost:9080', grpc.credentials.createInsecure())
const dgraphClient = new dgraph.DgraphClient(clientStub)

const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const multer = require('multer')
const upload = multer({dest: 'uploads/'})
const app = express()
app.set('json spaces', 2)

app.use((req, res, next) => {
  next()
  console.log(new Date(), req.method + ' ' + req.path, req.headers['user-agent'])
})

app.use(cookieParser())
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

const rack = require('hat').rack(128, 36)
const QueryFunction = require('./QueryFunction')
const User = require('./user')(dgraphClient, QueryFunction)
const Topic = require('./topic')(dgraphClient, dgraph, QueryFunction)
const Person = require('./person')(dgraphClient, dgraph, QueryFunction, Topic)
const Customer = require('./customer')(dgraphClient, dgraph, QueryFunction, rack)
const Network = require('./network')(dgraphClient, dgraph, Person, Topic)
const Invoice = require('./invoice')(dgraphClient, dgraph)
const Payment = require('./payment')(dgraphClient, dgraph, Invoice, fetch, baseUrl, mailSender, !isProduction)
const Ticket = require('./ticket')(dgraphClient, dgraph, Customer, Person, Invoice, Payment, QueryFunction, mailSender, templateGenerator, rack)

function getLoginUrl(req) {
  return baseUrl + 'login/' + encodeURIComponent(req.params.accessCode) + '/' + encodeURIComponent(encodeURIComponent(req.originalUrl))
}

const auth = require('./auth')(app, Person, Customer, Ticket, User, dgraphClient, dgraph, AUTH_SECRET, getLoginUrl)
const redirect = true
const allowAnonymous = true
const requireCodeOrAuth = (options = {}) => auth.authenticate(['jwt', 'access_code'], options)
const requireCodeAndHash = (options = {}) => auth.authenticate('codeNHash', options)
const requireJWT = (options = {}) => auth.authenticate('jwt', options)
const requireLogin = (options = {}) => auth.authenticate('login', options)

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    throw {status: 403, message: 'Not allowed'}
  } else {
    next()
  }
}

async function exec(func, res, type = 'json') {
  return func
    .catch(error => {
      res.status(error.status || 500)
      console.error(new Date(), error.stack || error)
      error = isProduction ? error.toString() : error.stack
      return type === 'json' ? {error} : error
    })
    .then(result => {
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
    })
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

app.use('/', express.static(path.join(__dirname, '/../public')))
app.use('/js-netvis', express.static(path.join(__dirname, '/../node_modules/js-netvis/dist')))
app.use('/qrcode', express.static(path.join(__dirname, '/../node_modules/qrcode/build')))

app.post('/login', requireLogin(), (req, res) => res.json({token: auth.signIn(req, res)}))
app.get('/login', requireJWT({allowAnonymous}), (req, res) => res.json({loggedIn: !!req.user}))
app.get('/login/:accessCode/:url', (req, res) => exec(loginPage(req.params.accessCode, req.params.url), res, 'send'))

app.post('/persons', requireJWT(), (req, res) => exec(doInTransaction(Person.upsert, [{}, req.body, req.user], true), res))
app.get('/persons/:uid', requireJWT({allowAnonymous}), (req, res) => exec(doInTransaction(Person.getPublicDetails, [req.params.uid, req.user]), res))
app.put('/persons/:uid', requireJWT(), (req, res) => exec(doInTransaction(Person.updateById, [req.params.uid, req.body, req.user], true), res))
app.put('/persons/:uid/picture', requireJWT(), upload.single('picture'), (req, res) => exec(doInTransaction(Person.uploadProfilePicture, [req.params.uid, req.file, req.user], true), res))
app.get('/persons/:uid/picture/:name', (req, res) => exec(doInTransaction(Person.getProfilePicture, req.params.uid), res, 'send'))

app.get('/topics', (req, res) => exec(doInTransaction(Topic.find, [req.query.q]), res))

app.get('/tickets', (req, res) => exec(getTicketPage(req.query.code), res, 'send'))
app.post('/tickets', (req, res) => exec(Ticket.buy(req.body, baseUrl), res))
app.get('/tickets/:accessCode', requireCodeOrAuth({redirect}), (req, res) => exec(Ticket.checkin(req.params.accessCode, baseUrl), res))
app.put('/tickets/:accessCode', requireJWT(), (req, res) => exec(Ticket.setParticipant(req.params.accessCode, req.body, baseUrl, subTemplates, req.user), res))
app.get('/tickets/:accessCode/show', requireCodeOrAuth({redirect}), (req, res) => exec(doInTransaction(getTicket, [req.params.accessCode, 'show']), res, 'send'))
app.get('/tickets/:accessCode/print', requireCodeOrAuth({redirect}), (req, res) => exec(doInTransaction(getTicket, [req.params.accessCode, 'print']), res, 'send'))

app.get('/accounts/my', requireJWT({redirect}), (req, res) => res.redirect(getAccountInfoURL(req.user)))
app.get('/accounts/:accessCode/info', requireCodeOrAuth({redirect}), (req, res) => exec(doInTransaction(getAccountInfoPage, req.params.accessCode), res, 'send'))
app.get('/accounts/:accessCode/password', (req, res) => exec(doInTransaction(sendPassword, req.params.accessCode, true), res, 'send'))
app.post('/accounts/:accessCode/password', requireJWT(), (req, res) => exec(doInTransaction(setPassword, [req.params.accessCode, req.body.password], true), res))
app.get('/accounts/:accessCode/password/reset', requireJWT({redirect}), (req, res) => exec(resetPassword(req.params.accessCode), res, 'send'))
app.get('/accounts/:accessCode/password/reset/:hash', requireCodeAndHash({redirect}), (req, res) => exec(resetPassword(req.params.accessCode), res, 'send'))
app.get('/accounts/:accessCode/invoices/current', requireCodeOrAuth({redirect}), (req, res) => exec(doInTransaction(getLastInvoice, req.params.accessCode), res, 'send'))

app.get('/paypal/ipn', (req, res) => res.redirect('/accounts/my', 303))
app.post('/paypal/ipn', (req, res) => res.send(Payment.paypalIpn(req)))

app.get('/network', requireJWT({allowAnonymous}), (req, res) => exec(Network.getGraph(req.query.what, req.user), res))
app.delete('/network', requireJWT(), (req, res) => exec(Network.rebuild(), res))

app.post('/orga', requireJWT(), requireAdmin, (req, res) => exec(doInTransaction(createOrgaMember, [req.body], true), res))
app.post('/orga/coupon', requireJWT(), requireAdmin, (req, res) => exec(doInTransaction(createCoupon, [], true), res))
app.get('/orga/fix', requireJWT(), requireAdmin, (req, res) => exec(doInTransaction(fixTopics, [], true), res))
app.get('/orga/participants', requireJWT(), requireAdmin, (req, res) => exec(doInTransaction(exportParticipants, req.query.format || 'txt'), res, 'send'))
app.get('/orga/invoices', requireJWT(), requireAdmin, (req, res) => exec(doInTransaction(listInvoices), res, 'send'))
app.put('/orga/invoices/:invoiceNo/paid', requireJWT(), requireAdmin, (req, res) => exec(doInTransaction(invoicePayment, [req.params.invoiceNo, true], true), res))
app.delete('/orga/invoices/:invoiceNo/paid', requireJWT(), requireAdmin, (req, res) => exec(doInTransaction(invoicePayment, [req.params.invoiceNo, false], true), res))
app.delete('/orga/invoices/:invoiceNo', requireJWT(), requireAdmin, (req, res) => exec(doInTransaction(Invoice.deleteInvoice, [req.params.invoiceNo, true], true), res))
app.get('/orga/tiles', requireJWT(), requireAdmin, (req, res) => exec(generateTile(req.query), res, 'send'))

app.use((err, req, res, next) => {
  res.status(err.status || 500)
  console.error(new Date(), err.stack || err)
  const message = err.message || err.toString()
  res.send(isProduction ? message : err.stack || message)
})

app.listen(port, () => console.log('Running on port ' + port +
  ' in ' + nodeenv + ' mode' +
  ' with baseURL=' + baseUrl +
  (Payment.useSandbox ? ' using sandbox' : ' using PayPal')
))

const subTemplates = ['ticketHeader', 'ticketData', 'menu', 'logo', 'footer']

async function loginPage(accessCode, url) {
  return templateGenerator.generate('login-page', {url, baseUrl, accessCode}, subTemplates)
}

async function getTicketPage(code) {
  return templateGenerator.generate('buy-ticket', {baseUrl, code}, subTemplates)
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
    baseUrl
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

async function sendPassword(txn, accessCode) {
  const method = accessCode.match(/^.*@.*\.\w+$/) ? 'findByEMail' : 'findByAccessCode'
  const customer = await Customer[method](txn, accessCode)
  accessCode = customer.access_code
  const mu = new dgraph.Mutation()
  const hash = rack()
  await mu.setSetNquads(`<${customer.uid}> <hash> "${hash}" .`)
  await txn.mutate(mu)

  const link = baseUrl + 'accounts/' + accessCode + '/password/reset/' + hash
  const html = templateGenerator.generate('sendPassword-mail', {baseUrl, link})
  const subject = 'XCamp Passwort Reset'
  const to = customer.person[0].email
  mailSender.send(to, subject, html)

  return templateGenerator.generate('password-sent', {baseUrl}, subTemplates)
}

async function resetPassword(accessCode) {
  return templateGenerator.generate('password-reset-form', {accessCode, baseUrl}, subTemplates)
}

async function setPassword(txn, accessCode, password) {
  const message = await auth.setPassword(txn, accessCode, password)
  return {isRedirection: true, url: baseUrl + 'accounts/' + accessCode + '/info?message=' + encodeURIComponent(message)}
}

async function createOrgaMember(txn, data) {
  data.payment = 'none'
  const customer = await Customer.create(txn, data)
  const tickets = await Ticket.create(txn, customer.person[0], data.ticketCount || 1)
  return Invoice.create(txn, data, customer, tickets)
}

async function createCoupon(txn) {
  const mu = new dgraph.Mutation()
  const access_code = rack()
  mu.setSetJson({type: 'coupon', access_code})
  const assigned = await txn.mutate(mu)
  return {type: 'coupon', uid: assigned.getUidsMap().get('blank-0'), link: baseUrl + 'tickets?code=' + access_code}
}

const toObject = (acc, cur) => ({...acc, [cur.uid]: cur})

async function fixTopics(txn) {
  const result = await txn.query(`{ all(func: anyofterms(type, "person topic")) { uid type name topics {uid name}}}`)
  const all = result.getJson().all
  const topics = all.filter(d => d.type === 'topic').reduce(toObject, {})
  const persons = all.filter(d => d.type === 'person').map(p => {
    if (p.topics) {
      p.topics.forEach(t => {
        topics[t.uid].inUse = true
      })
    }
    return p
  })
  return {
    inUse: Object.values(topics).filter(t => t.inUse).map(t => ({uid: t.uid, name: t.name})),
    unused: Object.values(topics).filter(t => !t.inUse).map(t => ({uid: t.uid, name: t.name}))
  }
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
      return `"${person.firstName}";"${person.lastName}";"${person.email}"`
    } else if (format === 'csv') {
      return `"${person.firstName}","${person.lastName}","${person.email}"`
    } else {
      return person.firstName + ' ' + person.lastName + ' &lt;' + person.email + '&gt;'
    }
  }).join('\n')

  if (format === 'csv') {
    return {
      mimeType: 'application/x-ms-excel',
      disposition: 'attachment',
      name: 'participants.csv',
      content
    }
  } else {
    return content.replace('\n', '<br>\n')
  }
}
