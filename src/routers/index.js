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

  const injectedModules = {express, auth, makeHandler, templateGenerator, mailSender, mailChimp, Payment, contentReader, Model, store, readModels, config}
  const list = fs.readdirSync(__dirname)
    .filter(name => name.match(/Router.js$/))
    .map(name => ({[name.replace('Router.js', '')]: require('./' + name)(injectedModules)}))
  const routers = Object.assign({}, ...list)
  const mainRouter = express.Router()

  mainRouter.get('/netvis', (req, res) => res.send(getNetVisPage()))
  mainRouter.get('/', (req, res) => res.redirect('xcamp2020'))
  mainRouter.get('/index', (req, res) => res.redirect('xcamp2020'))
  mainRouter.get('/session-list', makeHandler(getSessionList, {type: 'send'}))

  mainRouter.use('/', express.static(publicDir))
  mainRouter.use('/js-netvis', express.static(path.resolve(nodeDir, 'js-netvis')))
  mainRouter.use('/qrcode', express.static(path.resolve(nodeDir, 'qrcode', 'build')))

  mainRouter.use('/session', nocache, routers.Session)
  mainRouter.use('/newsletter', nocache, routers.Newsletter)
  mainRouter.use('/tickets', nocache, routers.Ticket)
  mainRouter.use('/accounts', nocache, routers.Accounts)
  mainRouter.use('/paypal/ipn', nocache, routers.Paypal)
  mainRouter.use('/orga', nocache, routers.Orga)
  mainRouter.use('/network', nocache, routers.Network)
  mainRouter.use('/blog', nocache, routers.Blog)
  mainRouter.use('/feed', nocache, routers.Feed)
  mainRouter.use('/', routers.Content)

  mainRouter.use((req, res) => res.status(404).send('Not found'))

  return mainRouter
}
