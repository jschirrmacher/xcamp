const paymentType = {
  paypal: 'PayPal',
  invoice: 'Rechnung',
  none: 'N/A'
}

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

  async function showAdminPage() {
    return templateGenerator.generate('administration')
  }

  async function checkinApp() {
    return templateGenerator.generate('checkinApp')
  }

  async function createOrgaMember(txn, data) {
    data.payment = 'none'
    const customer = await Model.Customer.create(txn, data)
    const tickets = await Model.Ticket.create(txn, customer.person[0], data.ticketCount || 1)
    await Model.Invoice.create(txn, data, customer, tickets)
    const user = readModels.user.getById(customer.uid)
    const action = 'accounts/' + customer.access_code + '/password/reset'
    const hash = mailSender.sendHashMail('send-free-ticket-mail', user, action)
    store.add({type: 'set-mail-hash', userId: user.id, hash})
  }

  async function listInvoices() {
    const stats = {
      participants: 0,
      totals: 0,
      totalsPaid: 0,
      tickets: {
        orga: 0,
        corporate: 0,
        private: 0,
        reduced: 0
      }
    }

    const invoices = (await readModels.invoice.getAll()).map(invoice => {
      stats.tickets[invoice.ticketType] += invoice.tickets.length
      stats.participants += invoice.tickets.length
      stats.totals += invoice.tickets.length * invoice.ticketPrice
      stats.totalsPaid += invoice.paid ? invoice.tickets.length * invoice.ticketPrice : 0
      return {
        ...invoice,
        created: Model.Invoice.getFormattedDate(new Date(invoice.created)),
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

  async function exportParticipants(txn, format) {
    const tickets = await Model.Network.getAllTickets(txn)
    const content = tickets.map(ticket => {
      const person = ticket.participant[0]
      if (format === 'excel') {
        return `"${person.firstName}";"${person.lastName}";"${person.email}";"${ticket.firm}"`
      } else if (format === 'csv') {
        return `"${person.firstName}","${person.lastName}","${person.email}","${ticket.firm}"`
      } else {
        return person.firstName + ' ' + person.lastName + ' &lt;' + person.email + '&gt; ' + ticket.firm
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

  function requireDevEnv(req, res, next) {
    if (config.isProduction) {
      next('Cannot use this route in a production environment')
    } else {
      next()
    }
  }

  function testLogin(req, res, asAdmin) {
    const isPersonInNetwork = personId => readModels.network.getById(personId).type === 'person'
    req.user = readModels.user.getAll()
      .find(u => isPersonInNetwork(u.personId) && (asAdmin && u.isAdmin || !asAdmin && !u.isAdmin))
    auth.signIn(req, res)
    res.redirect(config.baseUrl)
  }

  const router = express.Router()
  const redirect = true
  const allowAnonymous = true

  router.get('/', auth.requireJWT({redirect}), auth.requireAdmin(), makeHandler(showAdminPage, {type: 'send'}))
  router.post('/', auth.requireJWT({allowAnonymous}), auth.requireAdmin(), makeHandler(req => createOrgaMember(req.txn, req.body), {commit: true}))
  router.post('/coupon/reduced', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => Model.Ticket.createCoupon(req.txn, req.user, 'reduced'), {commit: true}))
  router.post('/coupon/earlybird', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => Model.Ticket.createCoupon(req.txn, req.user, 'earlybird'), {commit: true}))
  router.get('/participants', auth.requireJWT({redirect}), auth.requireAdmin(), makeHandler(req => exportParticipants(req.txn, req.query.format || 'txt'), {type: 'send', txn: true}))
  router.get('/invoices', auth.requireJWT({redirect}), auth.requireAdmin(), makeHandler(() => listInvoices(), {type: 'send'}))
  router.put('/invoices/:invoiceNo/paid', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => Model.Invoice.paid(req.txn, req.params.invoiceNo, true), {commit: true}))
  router.delete('/invoices/:invoiceNo/paid', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => Model.Invoice.paid(req.txn, req.params.invoiceNo, false), {commit: true}))
  router.delete('/invoices/:invoiceNo', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => Model.Invoice.deleteInvoice(req.txn, req.params.invoiceNo, true), {commit: true}))
  router.get('/checkin', auth.requireJWT({redirect}), auth.requireAdmin(), makeHandler(() => checkinApp(), {type: 'send'}))
  router.get('/tiles', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => generateTile(req.query), {type: 'send'}))

  router.get('/test/login/admin', requireDevEnv, (req, res) => testLogin(req, res, true))
  router.get('/test/login/user', requireDevEnv, (req, res) => testLogin(req, res, false))

  return router
}
