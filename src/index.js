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
const mailSender = require('./mailSender')(baseUrl, isProduction)

const clientStub = new dgraph.DgraphClientStub('localhost:9080', grpc.credentials.createInsecure())
const dgraphClient = new dgraph.DgraphClient(clientStub)

const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const multer = require('multer')
const upload = multer({dest: 'uploads/'})
const app = express()
app.set('json spaces', 2)

app.use(cookieParser())
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

const rack = require('hat').rack(128, 36)
const QueryFunction = require('./QueryFunction')
const Person = require('./person')(dgraphClient, dgraph, QueryFunction)
const Customer = require('./customer')(dgraphClient, dgraph, QueryFunction, rack)
const Network = require('./network')(dgraphClient, dgraph, Person)
const Invoice = require('./invoice')(dgraphClient, dgraph, rack)
const Payment = require('./payment')(dgraphClient, dgraph, Invoice, fetch, baseUrl, mailSender, true) // @todo set useSandbox parameter to !isProduction
const Ticket = require('./ticket')(dgraphClient, dgraph, Customer, Person, Invoice, Payment, QueryFunction, mailSender)

const auth = require('./auth')(app, Person, Customer, Ticket, dgraphClient, dgraph, AUTH_SECRET)
const passport = require('passport')
const requireCodeOrAuth = (req, res, next) => {
  passport.authenticate(['jwt', 'access_code'], (err, user) => {
    if (err) {
      return next(err)
    } else if (!user) {
      res.redirect('/login/' + encodeURIComponent(req.params.accessCode) + '/' + encodeURIComponent(req.originalUrl))
    } else {
      req.user = user
      next()
    }
  })(req, res, next)
}
const requireCodeAndHash = (req, res, next) => {
  passport.authenticate('codeNHash', (err, user) => {
    if (err) {
      next(err)
    } else if (!user) {
      res.redirect('/login/' + encodeURIComponent(req.params.accessCode) + '/' + encodeURIComponent(req.originalUrl))
    } else {
      req.user = user
      auth.signIn(req, res)
      next()
    }
  })(req, res, next)
}
const requireAuth = passport.authenticate('jwt', {session: false, failureRedirect: '/login'})
const requireCredentials = passport.authenticate('local', {session: false})

app.use((req, res, next) => {
  console.log(req.method, req.path)
  next()
})

async function exec(func, res, type = 'json') {
  return func
    .catch(error => {
      res.status(error.status || 500)
      error = isProduction ? error.toString() : error.stack
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

app.get('/login/:accessCode/:url', (req, res) => exec(loginPage(req.params.accessCode, req.params.url), res, 'send'))
app.post('/login', requireCredentials, (req, res) => res.json({token: auth.signIn(req, res)}))
app.get('/setpassword/:accessCode', (req, res) => exec(doInTransaction(sendPassword, req.params.accessCode, true), res, 'send'))
app.get('/setpassword/:accessCode/reset', requireAuth, (req, res) => exec(resetPassword(req.params.accessCode), res, 'send'))
app.get('/setpassword/:accessCode/reset/:hash', requireCodeAndHash, (req, res) => exec(resetPassword(req.params.accessCode), res, 'send'))
app.post('/setpassword/:accessCode', requireAuth, (req, res) => exec(doInTransaction(setPassword, [req.params.accessCode, req.body.password], true), res))

app.post('/persons', requireAuth, (req, res) => exec(doInTransaction(Person.upsert, [{}, req.body], true), res))
app.get('/persons/:uid', (req, res) => exec(doInTransaction(Person.getPublicDetails, req.params.uid), res))
app.put('/persons/:uid', requireAuth, (req, res) => exec(doInTransaction(Person.updateById, [req.params.uid, req.body], true), res))
app.put('/persons/:uid/picture', requireAuth, upload.single('picture'), (req, res) => exec(doInTransaction(Person.uploadProfilePicture, [req.params.uid, req.file], true), res))
app.get('/persons/:uid/picture', (req, res) => exec(doInTransaction(Person.getProfilePicture, req.params.uid), res, 'send'))

app.post('/tickets', (req, res) => exec(Ticket.buy(req.body, baseUrl), res))
app.put('/tickets/:ticketCode/accounts/:customerCode', requireAuth, (req, res) => {
  exec(Ticket.setCustomerAsParticipant(req.params.ticketCode, req.params.customerCode), res)
})
app.get('/tickets/:ticketCode', (req, res) => exec(Ticket.checkin(req.params.ticketCode, baseUrl), res))
app.put('/tickets/:ticketCode', (req, res) => exec(Ticket.setParticipant(req.params.ticketCode, req.body), res))
app.get('/tickets/:ticketCode/show', (req, res) => exec(doInTransaction(getTicket, [req.params.ticketCode, 'show']), res, 'send'))
app.get('/tickets/:ticketCode/print', (req, res) => exec(doInTransaction(getTicket, [req.params.ticketCode, 'print']), res, 'send'))
app.get('/tickets/:ticketCode/send', (req, res) => exec(doInTransaction(sendTicket, [req.params.ticketCode]), res))

app.get('/accounts/my', requireAuth, (req, res) => res.status(500).json({error: 'not yet implemented'}))   // show my account page
app.post('/accounts', (req, res) => res.status(500).json({error: 'not yet implemented'}))   // register as community user without ticket
app.put('/accounts/:accessCode', requireAuth, (req, res) => res.status(500).json({error: 'not yet implemented'}))
app.get('/accounts/:accessCode', requireAuth, (req, res) => exec(getAccountInfo(req.params.accessCode), res, 'send'))
app.get('/accounts/:accessCode/info', requireCodeOrAuth, (req, res) => exec(doInTransaction(getAccountInfoPage, req.params.accessCode), res, 'send'))
app.get('/accounts/:accessCode/invoices/current', requireCodeOrAuth, (req, res) => exec(doInTransaction(getLastInvoice, req.params.accessCode), res, 'send'))

app.get('/paypal/ipn', (req, res) => res.redirect('/accounts/my', 303))
app.post('/paypal/ipn', (req, res) => res.send(Payment.paypalIpn(req, !isProduction)))

app.get('/network', (req, res) => exec(Network.getGraph(), res))
app.delete('/network', (req, res) => exec(Network.rebuild(), res))

app.use((err, req, res, next) => {
  console.error(err)
})

app.listen(port, () => console.log('Running on port ' + port +
  ' in ' + nodeenv + ' mode' +
  ' with baseURL=' + baseUrl +
  (Payment.useSandbox ? ' using sandbox' : ' using PayPal')
))

const subTemplates = ['ticketHeader', 'ticketData']

async function loginPage(accessCode, url) {
  return templateGenerator.generate('login-page', {url, baseUrl, accessCode})
}

async function getAccountInfoPage(txn, accessCode) {
  const customer = await Customer.findByAccessCode(txn, accessCode)
  const invoice = await Invoice.getNewest(txn, customer.uid)
  return templateGenerator.generate('account-info', {accessCode, tickets: invoice.tickets, baseUrl}, subTemplates)
}

async function getLastInvoice(txn, accessCode) {
  const customer = await Customer.findByAccessCode(txn, accessCode)
  const invoice = await Invoice.getNewest(txn, customer.uid)
  return templateGenerator.generate('invoice', Invoice.getPrintableInvoiceData(invoice, baseUrl))
}

async function getTicket(txn, accessCode, mode) {
  const ticket = await Ticket.findByAccessCode(txn, accessCode)
  const disabled = mode === 'print' ? 'disabled' : ''
  const print = mode === 'print'
  const params = {mode, print, disabled, access_code: accessCode, participant: ticket.participant[0], baseUrl}
  return templateGenerator.generate('ticket', params, subTemplates)
}

async function sendTicket(txn, accessCode) {
  const ticket = await Ticket.findByAccessCode(txn, accessCode)
  const html = templateGenerator.generate('ticket-mail', {url: baseUrl + 'tickets/' + accessCode + '/show', baseUrl})
  const subject = 'XCamp Ticket'
  const to = ticket.participant[0].email
  return mailSender.send(to, subject, html)
}

async function sendPassword(txn, accessCode) {
  const customer = await Customer.findByAccessCode(txn, accessCode)
  const mu = new dgraph.Mutation()
  const hash = rack()
  await mu.setSetNquads(`<${customer.uid}> <hash> "${hash}" .`)
  await txn.mutate(mu)

  const link = baseUrl + 'setpassword/' + accessCode + '/reset/' + hash
  const html = templateGenerator.generate('sendPassword-mail', {baseUrl, link})
  const subject = 'XCamp Passwort Reset'
  const to = customer.person[0].email
  mailSender.send(to, subject, html)

  return templateGenerator.generate('password-sent', {baseUrl})
}

async function resetPassword(accessCode) {
  return templateGenerator.generate('password-reset-form', {accessCode, baseUrl})
}

async function setPassword(txn, accessCode, password) {
  const message = await auth.setPassword(txn, accessCode, password)
  return {isRedirection: true, url: '/accounts/' + accessCode + '/info?messge=' + encodeURIComponent(message)}
}
