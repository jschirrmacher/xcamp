const fs = require('fs')
const path = require('path')

module.exports = (dependencies) => {
  const {
    express,
    auth,
    dgraphClient,
    templateGenerator,
    mailSender,
    mailChimp,
    Model,
    store,
    readModels,
    config
  } = dependencies

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
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
    res.header('Expires', '-1')
    res.header('Pragma', 'no-cache')
    next()
  }

  const sessionRouter = require('./SessionRouter')({express, auth, makeHandler, templateGenerator, readModels, config})
  const newsletterRouter = require('./NewsletterRouter')({express, auth, makeHandler, templateGenerator, mailSender, mailChimp, Model, store})
  const accountsRouter = require('./AccountsRouter')({express, auth, makeHandler, templateGenerator, mailSender, Model, store, readModels, config})
  const ticketRouter = require('./TicketRouter')({express, auth, makeHandler, templateGenerator, mailSender, Model, store, readModels, config})
  const networkRouter = require('./NetworkRouter')({express, auth, makeHandler, templateGenerator, Model, store, readModels})
  const orgaRouter = require('./OrgaRouter')({express, auth, makeHandler, templateGenerator, mailSender, Model, readModels, store, config })
  const paypalRouter = require('./PaypalRouter')({express, makeHandler, Model})

  const router = express.Router()

  router.get('/', (req, res) => res.send(getNetVisPage()))
  router.use('/', express.static(path.join(__dirname, '/../public')))
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
