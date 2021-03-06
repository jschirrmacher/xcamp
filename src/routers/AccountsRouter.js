module.exports = (dependencies) => {
  const {
    express,
    auth,
    makeHandler,
    templateGenerator,
    mailSender,
    store,
    readModels,
    config
  } = dependencies

  function getAccountInfoURL(user) {
    return config.baseUrl + 'accounts/' + user.access_code + '/info'
  }

  function getNewestInvoice(user) {
    const customer = readModels.customer.getAll().find(c => c.personId === user.id)
    const invoices = readModels.invoice.getByCustomerId(customer.id)
    if (invoices && invoices.length) {
      return invoices[0]
    }
    return null
  }

  async function getAccountInfoPage(accessCode) {
    const user = readModels.user.getByAccessCode(accessCode)
    if (user.type === 'ticket') {
      const ticket = readModels.invoice.getTicketByAccessCode(accessCode)
      const invoice = readModels.invoice.getById(ticket.invoiceId)
      ticket.isPersonalized = true
      ticket.paid = invoice.paid
      return getAccountTemplate(null, [ticket])
    } else {
      const invoice = getNewestInvoice(user)
      const tickets = invoice.tickets
      tickets.forEach(t => t.paid = invoice.paid)
      return getAccountTemplate(invoice, tickets)
    }

    function getAccountTemplate(invoice, tickets) {
      return templateGenerator.generate('account-info', {
        invoice: invoice && invoice.invoiceNo ? invoice : null,
        accessCode,
        password: !!user.password,
        tickets
      })
    }
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
      const hash = mailSender.sendHashMail('mail/sendPassword-mail', user, 'accounts/' + user.access_code + '/password/reset')
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
    result.url = '#' + user.personId
    return result
  }

  const router = express.Router()
  const redirect = true

  router.get('/my', auth.requireJWT({redirect}), (req, res) => res.redirect(getAccountInfoURL(req.user)))
  router.get('/:accessCode/info', auth.requireCodeOrAuth({redirect}), makeHandler(req => getAccountInfoPage(req.params.accessCode), {type: 'send'}))
  router.get('/:accessCode/password', makeHandler(req => sendPassword(req.params.accessCode)))
  router.get('/password/sent', makeHandler(() => templateGenerator.generate('password-sent'), {type: 'send'}))
  router.get('/password/failed', makeHandler(() => templateGenerator.generate('password-failed'), {type: 'send'}))
  router.post('/password', auth.requireJWT(), makeHandler(req => setPassword(req.user, req.body.password)))
  router.get('/:accessCode/password/reset', auth.requireJWT({redirect}), makeHandler(req => resetPassword(req.params.accessCode), {type: 'send'}))
  router.get('/:accessCode/password/reset/:hash', auth.requireCodeAndHash({redirect}), makeHandler(req => resetPassword(req.params.accessCode), {type: 'send'}))
  router.get('/:accessCode/invoices/current', auth.requireCodeOrAuth({redirect}), makeHandler(req => getLastInvoice(req.params.accessCode), {type: 'send'}))

  return router
}
