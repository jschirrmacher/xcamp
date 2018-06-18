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
  console.log(new Date(), req.method, req.path, '->', res.statusCode)
})

app.use(cookieParser())
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

const rack = require('hat').rack(128, 36)
const QueryFunction = require('./QueryFunction')
const User = require('./user')(dgraphClient, QueryFunction)
const Person = require('./person')(dgraphClient, dgraph, QueryFunction)
const Customer = require('./customer')(dgraphClient, dgraph, QueryFunction, rack)
const Network = require('./network')(dgraphClient, dgraph, Person)
const Invoice = require('./invoice')(dgraphClient, dgraph, rack)
const Payment = require('./payment')(dgraphClient, dgraph, Invoice, fetch, baseUrl, mailSender, !isProduction)
const Ticket = require('./ticket')(dgraphClient, dgraph, Customer, Person, Invoice, Payment, QueryFunction, mailSender, templateGenerator)

function getLoginUrl(req) {
  return baseUrl + 'login/' + encodeURIComponent(req.params.accessCode) + '/' + encodeURIComponent(encodeURIComponent(req.originalUrl))
}
const auth = require('./auth')(app, Person, Customer, Ticket, dgraphClient, dgraph, AUTH_SECRET, getLoginUrl)
const redirect = true
const allowAnonymous = true
const requireCodeOrAuth = (options = {}) => auth.authenticate(['jwt', 'access_code'], options)
const requireCodeAndHash = (options = {}) => auth.authenticate('codeNHash', options)
const requireJWT = (options = {}) => auth.authenticate('jwt', options)
const requireLogin = (options = {}) => auth.authenticate('login', options)

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

app.post('/login', requireLogin(), (req, res) => res.json({token: auth.signIn(req, res)}))
app.get('/login', requireJWT({allowAnonymous}), (req, res) => res.json({loggedIn: !!req.user}))
app.get('/login/:accessCode/:url', (req, res) => exec(loginPage(req.params.accessCode, req.params.url), res, 'send'))

app.post('/persons', requireJWT(), (req, res) => exec(doInTransaction(Person.upsert, [{}, req.body, req.user], true), res))
app.get('/persons/:uid', requireJWT({allowAnonymous}), (req, res) => exec(doInTransaction(Person.getPublicDetails, [req.params.uid, req.user]), res))
app.put('/persons/:uid', requireJWT(), (req, res) => exec(doInTransaction(Person.updateById, [req.params.uid, req.body, req.user], true), res))
app.put('/persons/:uid/picture', requireJWT(), upload.single('picture'), (req, res) => exec(doInTransaction(Person.uploadProfilePicture, [req.params.uid, req.file, req.user], true), res))
app.get('/persons/:uid/picture', (req, res) => exec(doInTransaction(Person.getProfilePicture, req.params.uid), res, 'send'))

app.get('/tickets', (req, res) => exec(getTicketPage(), res, 'send'))
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
app.post('/paypal/ipn', (req, res) => res.send(Payment.paypalIpn(req, !isProduction)))

app.get('/network', requireJWT({allowAnonymous}), (req, res) => exec(Network.getGraph(req.user), res))
app.delete('/network', requireJWT(), (req, res) => exec(Network.rebuild(), res))

app.use((err, req, res, next) => {
  console.error(new Date(), err)
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

async function getTicketPage() {
  return templateGenerator.generate('buy-ticket', {baseUrl}, subTemplates)
}

function getAccountInfoURL(user) {
  return baseUrl + 'accounts/' + user.access_code + '/info'
}

async function getAccountInfoPage(txn, accessCode) {
  const user = await User.findByAccessCode(txn, accessCode)
  const customer = user.type === 'customer' ? await Customer.get(txn, user.uid) : null
  const invoice = customer ? await Invoice.getNewest(txn, customer.uid) : null
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
  return templateGenerator.generate('account-info', {invoice, accessCode, password, paid, tickets, baseUrl}, subTemplates)
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
