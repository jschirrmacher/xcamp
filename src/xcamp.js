const nodeenv = process.env.NODE_ENV || 'develop'
const isProduction = nodeenv === 'production'
const port = process.env.PORT || 8001
const DGRAPH_URL = process.env.DGRAPH_URL || 'localhost:9080'

const path = require('path')
const fs = require('fs')
const config = readConfigFile()

global.fetch = require('node-fetch')
const fetch = require('js-easy-fetch')()
const dgraph = require('dgraph-js')
const grpc = require('grpc')
const templateGenerator = require('./TemplateGenerator')(config)
const nodemailer = require('nodemailer')
const rack = require('hat').rack(128, 36)
const mailSender = require('./mailSender')(nodemailer, templateGenerator, config, rack)

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

const winston = require('winston')
const expressWinston = require('express-winston')
const loggerOptions = {
  level: process.env.LOGLEVEL || 'info',
  transports: [new winston.transports.Console()],
  format: winston.format.simple(),
  meta: false,
  colorize: false,
}
const logger = winston.createLogger(loggerOptions)

const EventStore = require('./EventStore')
const store = new EventStore({basePath: path.resolve('./store'), logger})
const readModels = require('./readModels')({store, config})
const QueryFunction = require('./QueryFunction')
const NotificationSender = require('./NotificationSender')({mailSender, readModels, config})
store.listen(NotificationSender.handleEvent)

const mailChimp = require('./mailchimp')(config.mailChimp, config.eventName, fetch, store)
const Payment = require('./PayPalAdapter')(fetch, store, readModels, config)
const Model = require('./Model')({dgraphClient, dgraph, QueryFunction, store, rack, mailSender, Payment, mailChimp, templateGenerator, config, readModels})
const auth = require('./auth')({app, readModels, store, config})
const mainRouter = require('./mainRouter')({express, auth, dgraphClient, templateGenerator, mailSender, mailChimp, Model, Payment, store, config, readModels, fetch})

const msg = `{{(new Date()).toISOString()}} {{res.responseTime}}ms {{res.statusCode}} {{req.method}} {{req.url}} - {{req.headers['user-agent']}}`
app.use(expressWinston.logger({...loggerOptions, msg}))
app.use('/', mainRouter)
app.use(expressWinston.errorLogger({...loggerOptions, meta: true}))

const server = app.listen(port, () => {
  const paymentType = config.paypal.useSandbox ? 'sandbox' : 'PayPal'
  logger.info(`Running on port ${port} in ${nodeenv} mode with baseURL=${config.baseUrl} using ${paymentType}`)
})

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received.')
  server.close(() => {
    logger.info('http server closed, closing event stream now.')
    store.end()
    process.exit(0)
  })
})

function readConfigFile() {
  let config
  const configFile = path.resolve(__dirname, '..', 'config', 'config.json')
  if (!fs.existsSync(configFile)) {
    console.warn('Using sample configuration - make sure you have an own before going producive')
    config = require(path.resolve(__dirname, '..', 'config', 'config-sample.json'))
  } else {
    config = require(configFile)
  }
  config.baseUrl = process.env.BASEURL
  config.isProduction = isProduction
  config.authSecret = process.env.AUTH_SECRET || (nodeenv === 'develop' && 'abcde')
  return config
}
