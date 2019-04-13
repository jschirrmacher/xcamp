module.exports = (dependencies) => {
  const {
    express,
    auth,
    makeHandler,
    templateGenerator,
    mailSender,
    Model,
    store,
    config
  } = dependencies

  function getAccountInfoURL(user) {
    return config.baseUrl + 'accounts/' + user.access_code + '/info'
  }

  async function getAccountInfoPage(txn, accessCode) {
    const user = await Model.User.findByAccessCode(txn, accessCode)
    const customer = user.type === 'customer' ? await Model.Customer.get(txn, user.uid) : null
    let invoice = customer ? await Model.Invoice.getNewest(txn, customer.uid) : null
    let tickets
    if (user.type === 'ticket') {
      const ticket = await Model.Ticket.get(txn, user.uid)
      ticket.participant = ticket.participant[0]
      ticket.isPersonalized = true
      tickets = [ticket]
    } else {
      tickets = invoice.tickets
    }
    const paid = invoice && invoice.paid
    const password = !!user.password
    invoice = invoice && invoice.invoiceNo ? invoice : null
    return templateGenerator.generate('account-info', {
      invoice,
      accessCode,
      password,
      paid,
      tickets,
      config
    })
  }

  async function getLastInvoice(txn, accessCode) {
    const customer = await Model.Customer.findByAccessCode(txn, accessCode)
    const invoice = await Model.Invoice.getNewest(txn, customer.uid)
    const data = {...Model.Invoice.getPrintableInvoiceData(invoice, config.baseUrl)}
    return templateGenerator.generate('invoice', data)
  }

  async function sendPassword(txn, accessCode) {
    const method = accessCode.match(/^.*@.*\.\w+$/) ? 'findByEMail' : 'findByAccessCode'
    const customer = await Model.Customer[method](txn, accessCode)
    const hash = await mailSender.sendHashMail(txn,'sendPassword-mail', customer, 'accounts/' + customer.access_code + '/password/reset')
    store.add({type: 'set-mail-hash', userId: customer.uid, hash})
    return templateGenerator.generate('password-sent')
  }

  async function resetPassword(accessCode) {
    return templateGenerator.generate('password-reset-form', {accessCode})
  }

  async function setPassword(txn, user, password) {
    const result = await auth.setPassword(txn, user.access_code, password)
    result.userId = Model.Network.getNodeId(user)
    return result
  }

  async function createAdditionalTicket(txn, accessCode) {
    const customer = await Model.Customer.findByAccessCode(txn, accessCode)
    const tickets = await Model.Ticket.create(txn, customer.person[0], 1)
    return Model.Invoice.addTicket(txn, customer.invoices[0], tickets[0])
  }

  const router = express.Router()
  const redirect = true

  router.get('/my', auth.requireJWT({redirect}), (req, res) => res.redirect(getAccountInfoURL(req.user)))
  router.get('/:accessCode/info', auth.requireCodeOrAuth({redirect}), makeHandler(req => getAccountInfoPage(req.txn, req.params.accessCode), {txn: true, type: 'send'}))
  router.get('/:accessCode/password', makeHandler(req => sendPassword(req.txn, req.params.accessCode), {type: 'send', commit: true}))
  router.post('/password', auth.requireJWT(), makeHandler(req => setPassword(req.txn, req.user, req.body.password), {commit: true}))
  router.get('/:accessCode/password/reset', auth.requireJWT({redirect}), makeHandler(req => resetPassword(req.params.accessCode), {type: 'send'}))
  router.get('/:accessCode/password/reset/:hash', auth.requireCodeAndHash({redirect}), makeHandler(req => resetPassword(req.params.accessCode), {type: 'send'}))
  router.get('/:accessCode/invoices/current', auth.requireCodeOrAuth({redirect}), makeHandler(req => getLastInvoice(req.txn, req.user.access_code), {type: 'send', txn: true}))
  router.post('/:accessCode/tickets', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => createAdditionalTicket(req.txn, req.params.accessCode), {commit: true}))

  return router
}
