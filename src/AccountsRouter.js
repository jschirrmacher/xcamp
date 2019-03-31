module.exports = (dependencies) => {
  const {
    express,
    auth,
    doInTransaction,
    makeHandler,
    templateGenerator,
    sendHashMail,
    User,
    Customer,
    Invoice,
    Ticket,
    store,
    config,
    baseUrl
  } = dependencies

  function getAccountInfoURL(user) {
    return baseUrl + 'accounts/' + user.access_code + '/info'
  }

  async function getAccountInfoPage(txn, accessCode) {
    const user = await User.findByAccessCode(txn, accessCode)
    const customer = user.type === 'customer' ? await Customer.get(txn, user.uid) : null
    let invoice = customer ? await Invoice.getNewest(txn, customer.uid) : null
    let tickets
    if (user.type === 'ticket') {
      const ticket = await Ticket.get(txn, user.uid)
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
    const customer = await Customer.findByAccessCode(txn, accessCode)
    const invoice = await Invoice.getNewest(txn, customer.uid)
    return templateGenerator.generate('invoice', Invoice.getPrintableInvoiceData(invoice))
  }

  async function sendPassword(txn, accessCode) {
    const method = accessCode.match(/^.*@.*\.\w+$/) ? 'findByEMail' : 'findByAccessCode'
    const customer = await Customer[method](txn, accessCode)
    const hash = sendHashMail(txn,'sendPassword-mail', customer, 'accounts/' + customer.access_code + '/password/reset')
    store.add({type: 'set-mail-hash', userId: customer.uid, hash})
    return templateGenerator.generate('password-sent')
  }

  async function resetPassword(accessCode) {
    return templateGenerator.generate('password-reset-form', {accessCode})
  }

  async function setPassword(txn, user, password) {
    const result = await auth.setPassword(txn, user.access_code, password)
    result.userId = Network.getNodeId(user)
    return result
  }

  async function createAdditionalTicket(txn, accessCode) {
    const customer = await Customer.findByAccessCode(txn, accessCode)
    const tickets = await Ticket.create(txn, customer.person[0], 1)
    return Invoice.addTicket(txn, customer.invoices[0], tickets[0])
  }

  const router = express.Router()
  const redirect = true

  router.get('/my', auth.requireJWT({redirect}), (req, res) => res.redirect(getAccountInfoURL(req.user)))
  router.get('/:accessCode/info', auth.requireCodeOrAuth({redirect}), makeHandler(req => doInTransaction(getAccountInfoPage, req.params.accessCode), 'send'))
  router.get('/:accessCode/password', makeHandler(req => doInTransaction(sendPassword, req.params.accessCode, true), 'send'))
  router.post('/password', auth.requireJWT(), makeHandler(req => doInTransaction(setPassword, [req.user, req.body.password], true)))
  router.get('/:accessCode/password/reset', auth.requireJWT({redirect}), makeHandler(req => resetPassword(req.params.accessCode), 'send'))
  router.get('/:accessCode/password/reset/:hash', auth.requireCodeAndHash({redirect}), makeHandler(req => resetPassword(req.params.accessCode), 'send'))
  router.get('/:accessCode/invoices/current', auth.requireCodeOrAuth({redirect}), makeHandler(req => doInTransaction(getLastInvoice, req.params.accessCode), 'send'))
  router.post('/:accessCode/tickets', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => doInTransaction(createAdditionalTicket, [req.params.accessCode], true)))

  return router
}
