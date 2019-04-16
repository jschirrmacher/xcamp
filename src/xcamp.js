const nodeenv = process.env.NODE_ENV || 'develop'
const isProduction = nodeenv === 'production'
const port = process.env.PORT || 8001
const DGRAPH_URL = process.env.DGRAPH_URL || 'localhost:9080'
const logger = console

const fs = require('fs')
const path = require('path')
const config = require(path.resolve(__dirname, '..', 'config', 'config.json'))
config.baseUrl = process.env.BASEURL
config.isProduction = isProduction
config.authSecret = process.env.AUTH_SECRET

global.fetch = require('node-fetch')
const fetch = require('js-easy-fetch')()
const dgraph = require('dgraph-js')
const grpc = require('grpc')
const subTemplates = ['ticketHeader', 'ticketData', 'menu', 'logo', 'footer', 'analytics', 'public-interest', 'privacy']
const templateGenerator = require('./TemplateGenerator')({globalData: config, subTemplates})
const nodemailer = require('nodemailer')
const rack = require('hat').rack(128, 36)
const mailSender = require('./mailSender')(dgraph, nodemailer, templateGenerator, config, rack)

const clientStub = new dgraph.DgraphClientStub(DGRAPH_URL, grpc.credentials.createInsecure())
const dgraphClient = new dgraph.DgraphClient(clientStub)

const express = require('express')
const app = express()
app.set('json spaces', 2)
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
app.use(cookieParser())
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

app.use((req, res, next) => {
  logger.info(new Date(), req.method + ' ' + req.path, req.headers['user-agent'])
  next()
})

const EventStore = require('./EventStore')
const store = new EventStore({basePath: path.resolve('./store'), logger})
const readModels = require('./readModels')({store, logger})
const actionHandlers = require('./actionHandlers')({store, logger, mailSender})

const QueryFunction = require('./QueryFunction')
const mailChimp = require('./mailchimp')(config.mailChimp, config.eventName, fetch, store)
const Model = require('./Model')({dgraphClient, dgraph, QueryFunction, store, rack, fetch, mailSender, mailChimp, templateGenerator, config, readModels})

function getLoginURL(req) {
  return config.baseUrl + 'session/' + encodeURIComponent(req.params.accessCode) + '/' + encodeURIComponent(encodeURIComponent(req.originalUrl))
}

const auth = require('./auth')({app, Model, dgraphClient, dgraph, getLoginURL, readModels, store, config})

const sessionRouter = require('./SessionRouter')({express, auth, makeHandler, templateGenerator, config})
const newsletterRouter = require('./NewsletterRouter')({express, auth, makeHandler, templateGenerator, mailSender, mailChimp, Model, store})
const accountsRouter = require('./AccountsRouter')({express, auth, makeHandler, templateGenerator, mailSender, Model, store, config})
const ticketRouter = require('./TicketRouter')({express, auth, makeHandler, templateGenerator, mailSender, mailChimp, Model, store, config})
const networkRouter = require('./NetworkRouter')({express, auth, makeHandler, templateGenerator, Model, readModels})
const orgaRouter = require('./OrgaRouter')({express, auth, makeHandler, templateGenerator, mailSender, Model, store, config})
const paypalRouter = require('./PaypalRouter')({express, makeHandler, Model})

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
app.use('/tickets', ticketRouter)
app.use('/accounts', accountsRouter)
app.use('/paypal/ipn', paypalRouter)
app.use('/orga', orgaRouter)
app.use('/network', networkRouter)

app.use((err, req, res, next) => {
  res.status(err.status || 500)
  logger.error(new Date(), err.stack || err)
  const message = err.message || err.toString()
  res.send(isProduction ? message : err.stack || message)
})

app.listen(port, () => logger.info('Running on port ' + port +
  ' in ' + nodeenv + ' mode' +
  ' with baseURL=' + config.baseUrl +
  (Model.Payment.useSandbox ? ' using sandbox' : ' using PayPal')
))
