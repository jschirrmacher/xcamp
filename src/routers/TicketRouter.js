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

  async function getTicketSalePage(code, type, isAdmin) {
    const coupon = code && readModels.coupon.getByAccessCode(code)
    if (code && !coupon) {
      return templateGenerator.generate('invalid-coupon-code')
    }
    const template = type === 'reduced' ? 'apply-to-reduced-ticket' : 'buy-ticket'
    const templateName = config.ticketSaleActive || isAdmin ? template : 'no-tickets-yet'
    const categories = Object.keys(config.ticketCategories).map(c => `${c}: ${config.ticketCategories[c]}`).join(',')
    const ticketType = code ? coupon.category : ''
    const message = config.ticketsSoldOut
      ? 'Leider ist schon alles ausverkauft. Melde dich bitte bei mail@xcamp.co, damit wir dich auf die Warteliste setzen können.'
      : 'Noch gibt es leider keine Tickets.'
    const data = {code, eventName: config.eventName, categories, ticketType, message}
    return templateGenerator.generate(templateName, data)
  }

  function getTicketFromAccessCode(accessCode) {
    return readModels.invoice.getTicketByAccessCode(accessCode)
  }

  async function getTicketPage(access_code, mode) {
    const ticket = getTicketFromAccessCode(access_code)
    const invoice = readModels.invoice.getById(ticket.invoiceId)
    return templateGenerator.generate('ticket', {
      mode,
      print: mode === 'print',
      disabled: mode === 'print' ? 'disabled' : '',
      access_code,
      participant: ticket && ticket.participant,
      paid: invoice.paid
    })
  }

  async function applyToReduced(person) {
    const html = templateGenerator.generate('mail/application-mail', person)
    const to = config['mail-recipients']['apply-to-reduced']
    store.add({type: 'applied-to-reduced', person})
    mailSender.send(to, `Bewerbung für ein vergünstigtes ${config.eventName} Ticket`, html)
    return templateGenerator.generate('applied-to-reduced')
  }

  const router = express.Router()
  const redirect = true
  const allowAnonymous = true

  router.get('/', auth.requireJWT({allowAnonymous}), makeHandler(req => getTicketSalePage(req.query.code, req.query.type, req.user && req.user.isAdmin), {type: 'send'}))
  router.post('/', makeHandler(req => Model.Ticket.buy(req.body)))
  router.post('/reduced', makeHandler(req => applyToReduced(req.body), {type: 'send'}))
  router.get('/:accessCode', auth.requireCodeOrAuth({redirect}), makeHandler(req => Model.Ticket.show(req.params.accessCode)))
  router.put('/:accessCode', auth.requireJWT(), makeHandler(req => Model.Ticket.setParticipant(req.params.accessCode, req.body, req.user)))
  router.get('/:accessCode/show', auth.requireCodeOrAuth({redirect}), makeHandler(req => getTicketPage(req.params.accessCode, 'show'), {type: 'send'}))
  router.get('/:accessCode/print', auth.requireCodeOrAuth({redirect}), makeHandler(req => getTicketPage(req.params.accessCode, 'print'), {type: 'send'}))
  router.get('/:accessCode/checkin', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => Model.Ticket.checkin(req.params.accessCode)))

  return router
}
