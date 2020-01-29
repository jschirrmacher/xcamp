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
    config,
    logger
  } = dependencies

  const makeHandler = require('../lib/makeHandler')({auth, templateGenerator, logger})
  const publicDir = path.resolve(__dirname, '..', '..', 'public')
  const nodeDir = path.resolve(__dirname, '..', '..', 'node_modules')
  const contentReader = require('../ContentReader')({config, logger})

  function getNetVisPage() {
    const index = fs.readFileSync(path.resolve(publicDir, 'network.html')).toString()
    const menu = templateGenerator.generate('sub/menu')
    const analytics = templateGenerator.generate('sub/analytics')
    return index.replace('<body>', '<body>\n' + menu + '\n').replace('</body>', analytics + '\n</body>')
  }

  function getSessionList() {
    const sessions = readModels.session.getAll().map(session => {
      const person = readModels.person.getById(session.person.id)
      session.image = readModels.network.getImageURL(person)
      // session.talk = session.talk.length < 140 ? session.talk : session.talk.substring(0, 139) + '…'
      session.url = person.url.trim()
        .replace(/^(?!https?:\/\/)/, 'https://')
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
  const blogRouter = require('./BlogRouter')({express, makeHandler, templateGenerator, contentReader, config})
  const contentRouter = require('./ContentRouter')({express, templateGenerator, contentReader, config, nocache})

  const router = express.Router()

  router.get('/netvis', (req, res) => res.send(getNetVisPage()))
  router.get('/', (req, res) => res.redirect('xcamp2020'))
  router.get('/index', (req, res) => res.redirect('xcamp2020'))
  router.get('/session-list', makeHandler(getSessionList, {type: 'send'}))

  router.use('/', express.static(publicDir))
  router.use('/js-netvis', express.static(path.resolve(nodeDir, 'js-netvis')))
  router.use('/qrcode', express.static(path.resolve(nodeDir, 'qrcode', 'build')))

  router.use('/session', nocache, sessionRouter)
  router.use('/newsletter', nocache, newsletterRouter)
  router.use('/tickets', nocache, ticketRouter)
  router.use('/accounts', nocache, accountsRouter)
  router.use('/paypal/ipn', nocache, paypalRouter)
  router.use('/orga', nocache, orgaRouter)
  router.use('/network', nocache, networkRouter)
  router.use('/blog', nocache, blogRouter)
  router.use('/', contentRouter)

  router.use((req, res) => res.status(404).send('Not found'))

  return router
}
