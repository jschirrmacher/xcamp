module.exports = (dependencies) => {
  const {
    express,
    auth,
    makeHandler,
    templateGenerator,
    mailSender,
    Model,
    store,
    readModels,
    config
  } = dependencies

  function getAccountInfoURL(user) {
    return config.baseUrl + 'accounts/' + user.access_code + '/info'
  }

  function getNewestInvoice(user) {
    if (user && user.type === 'customer') {
      const invoices = readModels.invoice.getByCustomerId(user.id)
      if (invoices && invoices.length) {
        return invoices[0]
      }
    }
    return null
  }

  async function getAccountInfoPage(txn, accessCode) {
    const user = readModels.user.getByAccessCode(accessCode)
    const invoice = getNewestInvoice(user)
    let tickets
    if (user.type === 'ticket') {
      const ticket = await Model.Ticket.get(txn, user.id)
      ticket.participant = ticket.participant[0]
      ticket.isPersonalized = true
      tickets = [ticket]
    } else {
      tickets = invoice.tickets
    }
    return templateGenerator.generate('account-info', {
      invoice: invoice && invoice.invoiceNo ? invoice : null,
      accessCode,
      password: !!user.password,
      paid: invoice && invoice.paid,
      tickets,
      config
    })
  }

  async function getLastInvoice(accessCode) {
    const invoice = getNewestInvoice(readModels.user.getByAccessCode(accessCode))
    if (!invoice) {
      throw 'Cannot find an invoice - maybe someone else bought yours?'
    }
    const data = {...readModels.invoice.getPrintableInvoiceData(invoice, config.baseUrl)}
    return templateGenerator.generate('invoice', data)
  }

  async function sendPassword(accessCode) {
    const method = accessCode.match(/^.*@.*\.\w+$/) ? 'getByEMail' : 'getByAccessCode'
    const user = await readModels.user[method](accessCode)
    if (user) {
      const hash = await mailSender.sendHashMail('sendPassword-mail', user, 'accounts/' + user.access_code + '/password/reset')
      store.add({type: 'set-mail-hash', userId: user.id, hash})
    }
    return {isRedirection: true, url: config.baseUrl + 'accounts/password/' + (user ? 'sent' : 'failed')}
  }

  async function resetPassword(accessCode) {
    return templateGenerator.generate('password-reset-form', {accessCode})
  }

  async function setPassword(user, password) {
    const result = await auth.setPassword(user.access_code, password)
    result.personId = user.personId
    result.url = user.ticketIds.length > 1 ? getAccountInfoURL(user) : '#' + user.personId
    return result
  }

  async function createAdditionalTicket(txn, accessCode) {
    const customer = await Model.Customer.findByAccessCode(txn, accessCode)
    const tickets = await Model.Ticket.create(txn, customer.person[0], 1)
    return Model.Invoice.addTicket(customer.invoices[0], tickets[0])
  }

  const router = express.Router()
  const redirect = true

  router.get('/my', auth.requireJWT({redirect}), (req, res) => res.redirect(getAccountInfoURL(req.user)))
  router.get('/:accessCode/info', auth.requireCodeOrAuth({redirect}), makeHandler(req => getAccountInfoPage(req.txn, req.params.accessCode), {txn: true, type: 'send'}))
  router.get('/:accessCode/password', makeHandler(req => sendPassword(req.params.accessCode)))
  router.get('/password/sent', makeHandler(() => templateGenerator.generate('password-sent'), {type: 'send'}))
  router.get('/password/failed', makeHandler(() => templateGenerator.generate('password-failed'), {type: 'send'}))
  router.post('/password', auth.requireJWT(), makeHandler(req => setPassword(req.user, req.body.password)))
  router.get('/:accessCode/password/reset', auth.requireJWT({redirect}), makeHandler(req => resetPassword(req.params.accessCode), {type: 'send'}))
  router.get('/:accessCode/password/reset/:hash', auth.requireCodeAndHash({redirect}), makeHandler(req => resetPassword(req.params.accessCode), {type: 'send'}))
  router.get('/:accessCode/invoices/current', auth.requireCodeOrAuth({redirect}), makeHandler(req => getLastInvoice(req.params.accessCode), {type: 'send'}))
  router.post('/:accessCode/tickets', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => createAdditionalTicket(req.txn, req.params.accessCode), {commit: true}))

  return router
}
