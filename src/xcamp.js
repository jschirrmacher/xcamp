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
const rack = require('hat').rack(128, 36)
const mailSender = require('./mailSender')(dgraph, baseUrl, isProduction, nodemailer, templateGenerator, config, rack)
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
  return baseUrl + 'session/' + encodeURIComponent(req.params.accessCode) + '/' + encodeURIComponent(encodeURIComponent(req.originalUrl))
}

const auth = require('./auth')(app, Person, Customer, Ticket, User, dgraphClient, dgraph, AUTH_SECRET, getLoginUrl, store)
const allowAnonymous = true

const sessionRouter = require('./SessionRouter')({express, auth, makeHandler, templateGenerator, baseUrl})
const newsletterRouter = require('./NewsletterRouter')({express, auth, makeHandler, templateGenerator, mailSender, mailChimp, Customer, store})
const accountsRouter = require('./AccountsRouter')({express, auth, makeHandler, templateGenerator, mailSender, User, Customer, Invoice, Ticket, store, config, baseUrl})
const ticketRouter = require('./TicketRouter')({express, auth, makeHandler, templateGenerator, mailSender, mailChimp, Ticket, store, config, baseUrl})
const personRouter = require('./PersonRouter')({express, auth, makeHandler, Person})
const orgaRouter = require('./OrgaRouter')({express, auth, makeHandler, templateGenerator, mailSender, Customer, Invoice, Ticket, Network, store, baseUrl})
const paypalRouter = require('./PaypalRouter')({express, makeHandler, Payment})

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

function getNetVisPage() {
  const index = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html')).toString()
  const menu = templateGenerator.generate('menu')
  const analytics = templateGenerator.generate('analytics')
  return index.replace('<body>', '<body>\n' + menu + '\n').replace('</body>', analytics + '\n</body>')
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

app.use(nocache)

app.use('/session', sessionRouter)
app.use('/newsletter', newsletterRouter)
app.use('/persons', personRouter)
app.use('/tickets', ticketRouter)
app.use('/accounts', accountsRouter)
app.use('/paypal/ipn', paypalRouter)
app.use('/orga', orgaRouter)

app.get('/network', auth.requireJWT({allowAnonymous}), makeHandler(req => Network.getGraph(req.query.what, req.user)))
app.delete('/network', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => Network.rebuild()))
app.get('/topics', makeHandler(req => Topic.find(req.txn, req.query.q), {txn: true}))
app.put('/topics/:uid', auth.requireJWT(), makeHandler(req => Topic.updateById(req.txn, req.params.uid, req.body, req.user), {commit: true}))
app.put('/roots/:uid', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => Root.updateById(req.txn, req.params.uid, req.body, req.user), {commit: true}))

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
