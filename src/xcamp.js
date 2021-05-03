const nodeenv = process.env.NODE_ENV || 'develop'
const isProduction = nodeenv === 'production'
const host = process.env.BASEURL || 'http://localhost'
const port = process.env.PORT || 8001

const Logger = require('./Logger')
const logger = Logger.setupStandardLogger()

const path = require('path')
const fs = require('fs')
const config = readConfigFile()
const adapters = require('./adapters')({ config })

global.fetch = require('node-fetch')
const fetch = require('js-easy-fetch')()
const templateGenerator = require('./TemplateGenerator')(config)
const nodemailer = require('nodemailer')
const rack = require('hat').rack(128, 36)
const mailSender = require('./mailSender')(nodemailer, templateGenerator, config, rack)

const express = require('express')
const app = express()
app.set('json spaces', 2)
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
app.use(cookieParser())
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

const EventStore = require('./EventStore')
const store = new EventStore({basePath: path.resolve('./store'), logger})
const readModels = require('./readModels')({store, config})
const NotificationSender = require('./NotificationSender')({mailSender, readModels, config})
store.listen(NotificationSender.handleEvent)
const synchronizer = require('./RCSynchronizer')({ readModels, store, adapters })
store.replay().then(() => synchronizer())

const mailChimp = require('./mailchimp')(config.mailChimp, config.eventName, fetch, store)
const Payment = require('./PayPalAdapter')(fetch, store, readModels, config)
const Model = require('./writeModels')({store, rack, mailSender, Payment, mailChimp, templateGenerator, config, readModels, adapters})
const auth = require('./auth')({app, readModels, store, config})
const mainRouter = require('./routers')({express, auth, templateGenerator, mailSender, mailChimp, Model, Payment, store, config, readModels, fetch, logger})

Logger.attachToExpress(app, mainRouter)

const server = app.listen(port, () => {
  const paymentType = config.paypal.useSandbox ? 'sandbox' : 'PayPal'
  logger.info(`Running on ${config.baseUrl} in ${nodeenv} mode using ${paymentType}`)
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
  const basePath = path.resolve(__dirname, '..')
  const configFile = path.join(basePath, 'config', 'config.json')
  if (!fs.existsSync(configFile)) {
    logger.warn('Using sample configuration - make sure you have an own before going producive')
    config = require(path.join(basePath, 'config', 'config-sample.json'))
  } else {
    config = require(configFile)
  }
  config.baseUrl = host + ':' + port + '/'
  config.basePath = basePath
  config.isProduction = isProduction
  config.authSecret = process.env.AUTH_SECRET || (nodeenv === 'develop' && 'abcde')
  return config
}
