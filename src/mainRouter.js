const fs = require('fs')
const path = require('path')

module.exports = (dependencies) => {
  const {
    express,
    auth,
    templateGenerator,
    mailSender,
    mailChimp,
    Model,
    Payment,
    store,
    readModels,
    config
  } = dependencies

  const makeHandler = require('./lib/makeHandler')(auth)
  const publicDir = path.resolve(__dirname, '..', 'public')

  function getNetVisPage() {
    const index = fs.readFileSync(path.resolve(publicDir, 'network.html')).toString()
    const menu = templateGenerator.generate('sub/menu')
    const analytics = templateGenerator.generate('sub/analytics')
    return index.replace('<body>', '<body>\n' + menu + '\n').replace('</body>', analytics + '\n</body>')
  }

  function getIndexPage() {
    const sponsors = JSON.parse(fs.readFileSync(path.resolve(publicDir, 'sponsors', 'sponsors.json')))
    const partners = JSON.parse(fs.readFileSync(path.resolve(publicDir, 'partners', 'partners.json')))
    return templateGenerator.generate('index', {sponsors, partners})
  }

  function getSessionList() {
    const sessions = readModels.session.getAll().map(session => {
      const person = readModels.person.getById(session.person.id)
      session.image = readModels.network.getImageURL(person)
      // session.talk = session.talk.length < 140 ? session.talk : session.talk.substring(0, 139) + '…'
      session.url = person.url.trim()
        .replace(/^(?!https?:\/\/)/, 'https:\/\/')
      session.urlTitle = person.url.trim()
        .replace(/^(https?:\/\/)?(www\.)?(facebook.de\/|xing.com\/profile\/)?/, '')
        .replace(/\/.*$/, '')
        .replace(/_/, ' ')
      return session
    })
    return templateGenerator.generate('session-list', {sessions})
  }

  function nocache(req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
    res.header('Expires', '-1')
    res.header('Pragma', 'no-cache')
    next()
  }

  const sessionRouter = require('./SessionRouter')({express, auth, makeHandler, templateGenerator, readModels, config})
  const newsletterRouter = require('./NewsletterRouter')({express, auth, makeHandler, templateGenerator, mailSender, mailChimp, Model, store, readModels})
  const accountsRouter = require('./AccountsRouter')({express, auth, makeHandler, templateGenerator, mailSender, store, readModels, config})
  const ticketRouter = require('./TicketRouter')({express, auth, makeHandler, templateGenerator, mailSender, Model, store, readModels, config})
  const networkRouter = require('./NetworkRouter')({express, auth, makeHandler, Model, store, readModels, config})
  const orgaRouter = require('./OrgaRouter')({express, auth, makeHandler, templateGenerator, mailSender, Model, readModels, store, config })
  const paypalRouter = require('./PaypalRouter')({express, makeHandler, Payment})

  const router = express.Router()

  router.get('/', (req, res) => res.send(getNetVisPage()))
  router.get('/index', (req, res) => res.send(getIndexPage()))
  router.get('/session-list', makeHandler(getSessionList, {type: 'send'}))

  router.use('/', express.static(publicDir))
  router.use('/js-netvis', express.static(path.join(__dirname, '/../node_modules/js-netvis')))
  router.use('/qrcode', express.static(path.join(__dirname, '/../node_modules/qrcode/build')))

  router.use(nocache)

  router.use('/session', sessionRouter)
  router.use('/newsletter', newsletterRouter)
  router.use('/tickets', ticketRouter)
  router.use('/accounts', accountsRouter)
  router.use('/paypal/ipn', paypalRouter)
  router.use('/orga', orgaRouter)
  router.use('/network', networkRouter)

  return router
}
