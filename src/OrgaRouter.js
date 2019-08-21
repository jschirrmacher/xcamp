const paymentType = {
  paypal: 'PayPal',
  invoice: 'Rechnung',
  none: 'N/A'
}

const Formatter = require('./lib/Formatter')

module.exports = (dependencies) => {
  const {
    express,
    auth,
    makeHandler,
    templateGenerator,
    mailSender,
    Model,
    readModels,
    store,
    config
  } = dependencies

  const ticketTypes = require('./ticketTypes')(config)

  async function showAdminPage() {
    return templateGenerator.generate('administration')
  }

  async function checkinApp() {
    return templateGenerator.generate('checkinApp')
  }

  async function createOrgaMember(txn, data) {
    data.payment = 'none'
    data.ticketCount = data.ticketCount || 1
    const customer = await Model.Customer.create(txn, data)
    await Model.Invoice.create(data, customer)
    const user = readModels.user.getById(customer.id)
    const action = 'accounts/' + customer.access_code + '/password/reset'
    const hash = mailSender.sendHashMail('mail/send-free-ticket-mail', user, action)
    store.add({type: 'set-mail-hash', userId: user.id, hash})
  }

  async function listInvoices() {
    const stats = {
      participants: 0,
      totals: 0,
      totalsPaid: 0,
      tickets: {
        free: 0,
        corporate: 0,
        private: 0,
        reduced: 0
      }
    }

    const invoices = (await readModels.invoice.getAll()).map(invoice => {
      stats.tickets[ticketTypes[invoice.ticketType].category] += invoice.tickets.length
      stats.participants += invoice.tickets.length
      stats.totals += invoice.tickets.length * invoice.ticketPrice
      stats.totalsPaid += invoice.paid ? invoice.tickets.length * invoice.ticketPrice : 0
      return {
        ...invoice,
        created: Formatter.date(new Date(invoice.created)),
        payment: invoice.paid ? paymentType[invoice.payment] : 'Offen',
        participants: invoice.tickets.filter(ticket => ticket.participant).map(ticket => {
          const participant = ticket.participant
          participant.checkedIn = ticket.checkedIn ? 'checked' : ''
          return participant
        }),
        paid: invoice.paid ? 'paid' : 'open'
      }
    })
    stats.totals = stats.totals.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
    stats.totalsPaid = stats.totalsPaid.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
    return templateGenerator.generate('invoices-list', {
      invoices,
      stats
    })
  }

  async function generateTile(data) {
    const colorSelect = () => value => {
      const flags = {};
      ['yellow', 'turquoise', 'red', 'grey', 'tuatara'].forEach(color => {
        flags['is_' + color] = color === data[value] ? 'selected' : ''
      })
      return templateGenerator.generate('colorOptions', flags)
    }
    return templateGenerator.generate('tile-form', {colorSelect, ...data})
  }

  async function exportParticipants(format) {
    const tickets = await readModels.invoice.getAllTickets()
    const content = tickets.map(ticket => {
      if (format === 'excel') {
        return `"${ticket.firstName}";"${ticket.lastName}";"${ticket.email}";"${ticket.firm}"`
      } else if (format === 'csv') {
        return `"${ticket.firstName}","${ticket.lastName}","${ticket.email}","${ticket.firm}"`
      } else {
        return ticket.firstName + ' ' + ticket.lastName + ' &lt;' + ticket.email + '&gt; ' + ticket.firm
      }
    }).join('\n')

    if (format === 'csv' || format === 'excel') {
      return {
        mimeType: 'application/x-ms-excel',
        disposition: 'attachment',
        name: 'participants.csv',
        content
      }
    } else {
      return content.replace(/\n/g, '<br>\n')
    }
  }

  function paid(invoiceId) {
    const invoice = readModels.invoice.getById(invoiceId)
    store.add({type: 'payment-received', invoiceId})
    if (!invoice.invoiceNo) {
      store.add({type: 'invoice-updated', invoice: {id: invoiceId, invoiceNo: readModels.invoice.getMaxInvoiceNo() + 1}})
    }
  }

  function unpaid(invoiceId) {
    store.add({type: 'payment-withdrawn', invoiceId})
  }

  function deleteInvoice(invoiceId) {
    store.add({type: 'invoice-deleted', invoiceId})
  }

  function requireDevEnv(req, res, next) {
    if (config.isProduction) {
      next('Cannot use this route in a production environment')
    } else {
      next()
    }
  }

  function testLogin(req, res, asAdmin) {
    const isPersonInNetwork = function (personId) {
      const person = readModels.network.getById(personId)
      return person && person.type === 'person'
    }
    req.user = readModels.user.getAll()
      .find(u => isPersonInNetwork(u.personId) && (asAdmin && u.isAdmin || !asAdmin && !u.isAdmin))
    auth.signIn(req, res)
    res.redirect(config.baseUrl)
  }

  function testLogout(req, res) {
    auth.logout(res)
    res.redirect(config.baseUrl)
  }

  const router = express.Router()
  const redirect = true
  const allowAnonymous = true

  router.get('/', auth.requireJWT({redirect}), auth.requireAdmin(), makeHandler(showAdminPage, {type: 'send'}))
  router.post('/', auth.requireJWT({allowAnonymous}), auth.requireAdmin(), makeHandler(req => createOrgaMember(req.txn, req.body), {commit: true}))
  router.post('/coupon/reduced', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => Model.Ticket.createCoupon(req.user, 'reduced')))
  router.post('/coupon/earlybird', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => Model.Ticket.createCoupon(req.user, 'earlybird')))
  router.get('/participants', auth.requireJWT({redirect}), auth.requireAdmin(), makeHandler(req => exportParticipants(req.query.format || 'txt'), {type: 'send'}))
  router.get('/invoices', auth.requireJWT({redirect}), auth.requireAdmin(), makeHandler(() => listInvoices(), {type: 'send'}))
  router.put('/invoices/:invoiceId/paid', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => paid(req.params.invoiceId)))
  router.delete('/invoices/:invoiceId/paid', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => unpaid(req.params.invoiceId)))
  router.delete('/invoices/:invoiceId', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => deleteInvoice(req.params.invoiceId)))
  router.get('/checkin', auth.requireJWT({redirect}), auth.requireAdmin(), makeHandler(() => checkinApp(), {type: 'send'}))
  router.get('/tiles', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => generateTile(req.query), {type: 'send'}))

  router.get('/test/login/admin', requireDevEnv, (req, res) => testLogin(req, res, true))
  router.get('/test/login/user', requireDevEnv, (req, res) => testLogin(req, res, false))
  router.get('/test/logout', requireDevEnv, (req, res) => testLogout(req, res))

  return router
}
