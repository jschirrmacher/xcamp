module.exports = (dependencies) => {
  const {
    express,
    auth,
    makeHandler,
    templateGenerator,
    Ticket,
    config,
    baseUrl
  } = dependencies

  async function getTicketPage(code, isAdmin) {
    const templateName = config.ticketSaleStarted || isAdmin ? 'buy-ticket' : 'no-tickets-yet'
    const categories = Object.keys(config.ticketCategories).map(c => `${c}: ${config.ticketCategories[c]}`).join(',')
    const data = {code, eventName: config.eventName, categories}
    return templateGenerator.generate(templateName, data)
  }

  async function getTicket(txn, accessCode, mode) {
    const ticket = await Ticket.findByAccessCode(txn, accessCode)
    const disabled = mode === 'print' ? 'disabled' : ''
    const print = mode === 'print'
    const params = {mode, print, disabled, access_code: accessCode, participant: ticket.participant[0]}
    return templateGenerator.generate('ticket', params)
  }

  const router = express.Router()
  const redirect = true
  const allowAnonymous = true

  router.get('/', auth.requireJWT({allowAnonymous}), makeHandler(req => getTicketPage(req.query.code, req.user && req.user.isAdmin), {type: 'send'}))
  router.post('/', makeHandler(req => Ticket.buy(req.body, baseUrl)))
  router.get('/:accessCode', auth.requireCodeOrAuth({redirect}), makeHandler(req => Ticket.show(req.params.accessCode, baseUrl)))
  router.put('/:accessCode', auth.requireJWT(), makeHandler(req => Ticket.setParticipant(req.txn, req.params.accessCode, req.body, baseUrl, req.user), {commit: true}))
  router.get('/:accessCode/show', auth.requireCodeOrAuth({redirect}), makeHandler(req => getTicket(req.txn, req.params.accessCode, 'show'), {type: 'send', txn: true}))
  router.get('/:accessCode/print', auth.requireCodeOrAuth({redirect}), makeHandler(req => getTicket(req.txn, req.params.accessCode, 'print'), {type: 'send', txn: true}))
  router.get('/:accessCode/checkin', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => Ticket.checkin(req.txn, req.params.accessCode), {commit: true}))

  return router
}
