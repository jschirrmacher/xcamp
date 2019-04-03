const nodeenv = process.env.NODE_ENV || 'develop'
const isProduction = nodeenv === 'production'
const port = process.env.PORT || 8001
const baseUrl = process.env.BASEURL
const AUTH_SECRET = process.env.AUTH_SECRET
const DGRAPH_URL = process.env.DGRAPH_URL || 'localhost:9080'
const logger = console

const fs = require('fs')
const path = require('path')
const config = require(path.resolve(__dirname, '..', 'config', 'config.json'))
global.fetch = require('node-fetch')
const fetch = require('js-easy-fetch')()
const dgraph = require('dgraph-js')
const grpc = require('grpc')
const subTemplates = ['ticketHeader', 'ticketData', 'menu', 'logo', 'footer', 'analytics', 'public-interest', 'privacy']
const globalData = {baseUrl, trackingId: config.analyticsTrackingId, eventName: config.eventName}
const templateGenerator = require('./TemplateGenerator')({globalData, subTemplates})
const nodemailer = require('nodemailer')
const mailSender = require('./mailSender')(baseUrl, isProduction, nodemailer, templateGenerator, config)
const eventName = config.eventName

const clientStub = new dgraph.DgraphClientStub(DGRAPH_URL, grpc.credentials.createInsecure())
const dgraphClient = new dgraph.DgraphClient(clientStub)

const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
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
const Root = require('./root')(dgraphClient, dgraph, QueryFunction, store)
const Topic = require('./topic')(dgraphClient, dgraph, QueryFunction, store)
const Person = require('./person')(dgraphClient, dgraph, QueryFunction, Topic, store)
const Customer = require('./customer')(dgraphClient, dgraph, QueryFunction, rack, store)
const Network = require('./network')(dgraphClient, dgraph, Person, Topic, store)
const Invoice = require('./invoice')(dgraphClient, dgraph, store)
const Payment = require('./payment')(dgraphClient, dgraph, Invoice, fetch, baseUrl, mailSender, !isProduction, store)
const mailChimp = require('./mailchimp')(config.mailChimp, eventName, fetch, store)
const Ticket = require('./ticket')(dgraphClient, dgraph, Customer, Person, Invoice, Payment, QueryFunction, mailSender, templateGenerator, mailChimp, rack, store, eventName)

function getLoginUrl(req) {
  return baseUrl + 'login/' + encodeURIComponent(req.params.accessCode) + '/' + encodeURIComponent(encodeURIComponent(req.originalUrl))
}

const auth = require('./auth')(app, Person, Customer, Ticket, User, dgraphClient, dgraph, AUTH_SECRET, getLoginUrl, store)
const allowAnonymous = true

const newsletterRouter = require('./NewsletterRouter')({express, auth, makeHandler, templateGenerator, sendHashMail, mailChimp, Customer, store})
const accountsRouter = require('./AccountsRouter')({express, auth, makeHandler, templateGenerator, sendHashMail, User, Customer, Invoice, Ticket, store, config, baseUrl})
const ticketRouter = require('./TicketRouter')({express, auth, makeHandler, templateGenerator, mailSender, mailChimp, Ticket, store, config, baseUrl})
const personRouter = require('./PersonRouter')({express, auth, makeHandler, Person})
const orgaRouter = require('./OrgaRouter')({express, auth, makeHandler, templateGenerator, sendHashMail, Customer, Invoice, Ticket, Network, store, baseUrl})

function makeHandler(func, options = {}) {
  const {type = 'json', txn = false, commit = false} = options
  return async function (req, res, next) {
    try {
      req.txn = txn || commit ? dgraphClient.newTxn() : undefined
      const result = await func(req)
      if (commit) {
        req.txn.commit()
      }
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
    } finally {
      if (txn) {
        req.txn.discard()
      }
    }
  }
}

function sendUserInfo() {
  return (req, res) => res.json({
    loggedIn: !!req.user,
    hasPasswordSet: req.user && !!req.user.password,
    access_code: req.user && req.user.access_code
  })
}

function getNetVisPage() {
  const index = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html')).toString()
  const menu = templateGenerator.generate('menu')
  const analytics = templateGenerator.generate('analytics')
  return index.replace('<body>', '<body>\n' + menu + '\n').replace('</body>', analytics + '\n</body>')
}

function logout(req, res) {
  auth.logout(res)
  res.redirect('.')
}

function nocache(req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  next();
}

app.get('/', (req, res) => res.send(getNetVisPage()))
app.use('/', express.static(path.join(__dirname, '/../public')))
app.use('/js-netvis', express.static(path.join(__dirname, '/../node_modules/js-netvis')))

app.use('/qrcode', express.static(path.join(__dirname, '/../node_modules/qrcode/build')))

app.post('/login', auth.requireLogin(), (req, res) => res.json({token: auth.signIn(req, res)}))
app.get('/login', auth.requireJWT({allowAnonymous}), sendUserInfo())
app.get('/login/:accessCode/:url', makeHandler(req => loginPage(req.params.accessCode, req.params.url), {type: 'send'}))
app.get('/logout', nocache, logout)

app.use('/newsletter', auth.requireJWT({allowAnonymous}), newsletterRouter)
app.use('/persons', personRouter)

app.get('/topics', makeHandler(req => Topic.find(req.txn, req.query.q), {txn: true}))
app.put('/topics/:uid', auth.requireJWT(), makeHandler(req => Topic.updateById(req.txn, req.params.uid, req.body, req.user), {commit: true}))
app.put('/roots/:uid', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => Root.updateById(req.txn, req.params.uid, req.body, req.user), {commit: true}))

app.use('/tickets', ticketRouter)
app.use('/accounts', accountsRouter)

app.get('/paypal/ipn', (req, res) => res.redirect('/accounts/my', 303))
app.post('/paypal/ipn', (req, res) => res.send(Payment.paypalIpn(req)))

app.get('/network', auth.requireJWT({allowAnonymous}), makeHandler(req => Network.getGraph(req.query.what, req.user)))
app.delete('/network', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => Network.rebuild()))

app.use('/orga', orgaRouter)

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

async function loginPage(accessCode, url) {
  return templateGenerator.generate('login-page', {url, accessCode})
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
  mailSender.send(to, subject, html)
  return hash
}
