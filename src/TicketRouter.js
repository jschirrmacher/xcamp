module.exports = (dependencies) => {
  const {
    express,
    auth,
    makeHandler,
    templateGenerator,
    mailSender,
    mailChimp,
    Model,
    store,
    config
  } = dependencies

  async function getTicketPage(code, type, isAdmin) {
    const template = type === 'reduced' ? 'apply-to-reduced-ticket' : 'buy-ticket'
    const templateName = config.ticketSaleStarted || isAdmin ? template : 'no-tickets-yet'
    const categories = Object.keys(config.ticketCategories).map(c => `${c}: ${config.ticketCategories[c]}`).join(',')
    const data = {code, eventName: config.eventName, categories}
    return templateGenerator.generate(templateName, data)
  }

  async function getTicket(txn, accessCode, mode) {
    const ticket = await Model.Ticket.findByAccessCode(txn, accessCode)
    const disabled = mode === 'print' ? 'disabled' : ''
    const print = mode === 'print'
    const params = {mode, print, disabled, access_code: accessCode, participant: ticket.participant[0]}
    return templateGenerator.generate('ticket', params)
  }

  async function applyToReduced(data) {
    await mailChimp.addSubscriber({person: [data]})
    const html = templateGenerator.generate('application-mail', data)
    const to = config['mail-recipients']['apply-to-reduced']
    mailSender.send(to, `Bewerbung für ein vergünstigtes ${config.eventName} Ticket`, html)
    store.add({type: 'applied-to-reduced', data})
    return templateGenerator.generate('applied-to-reduced')
  }

  const router = express.Router()
  const redirect = true
  const allowAnonymous = true

  router.get('/', auth.requireJWT({allowAnonymous}), makeHandler(req => getTicketPage(req.query.code, req.query.type, req.user && req.user.isAdmin), {type: 'send'}))
  router.post('/', makeHandler(req => Model.Ticket.buy(req.body, config.baseUrl)))
  router.post('/reduced', makeHandler(req => applyToReduced(req.body), {type: 'send'}))
  router.get('/:accessCode', auth.requireCodeOrAuth({redirect}), makeHandler(req => Model.Ticket.show(req.params.accessCode, config.baseUrl)))
  router.put('/:accessCode', auth.requireJWT(), makeHandler(req => Model.Ticket.setParticipant(req.txn, req.params.accessCode, req.body, config.baseUrl, req.user), {commit: true}))
  router.get('/:accessCode/show', auth.requireCodeOrAuth({redirect}), makeHandler(req => getTicket(req.txn, req.params.accessCode, 'show'), {type: 'send', txn: true}))
  router.get('/:accessCode/print', auth.requireCodeOrAuth({redirect}), makeHandler(req => getTicket(req.txn, req.params.accessCode, 'print'), {type: 'send', txn: true}))
  router.get('/:accessCode/checkin', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => Model.Ticket.checkin(req.txn, req.params.accessCode), {commit: true}))

  return router
}
