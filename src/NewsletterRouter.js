module.exports = (dependencies) => {
  const {
    express,
    MailChimp,
    config,
    makeHandler,
    doInTransaction,
    templateGenerator,
    fetch,
    Customer,
    sendHashMail,
    requireCodeAndHash,
    store
  } = dependencies

  async function getNewsletterPage() {
    return templateGenerator.generate('register-newsletter', {eventName: config.eventName})
  }

  async function registerForNewsletter(txn, data) {
    let customer
    try {
      customer = await Customer.create(txn, data)
      const subject = 'XCamp Newsletter - Bitte bestätigen!'
      const action = 'newsletter/approve/' + customer.access_code
      await sendHashMail(txn, 'newsletter-approval-mail', customer, action, subject)
      store.add({type: 'newsletter-subscription', customer})
      const firstName = customer.person[0].firstName
      return templateGenerator.generate('register-success', {firstName})
    } catch (e) {
      return templateGenerator.generate('register-failed', {message: e.message || e.toString()})
    }
  }

  async function approveRegistration(txn, code) {
    try {
      const customer = await Customer.findByAccessCode(txn, code)
      const person = customer.person[0]
      const member = {
        email_address: person.email,
        merge_fields: {FNAME: person.firstName, LNAME: person.lastName}
      }
      await mailChimp.addSubscriber(config.mailChimp.eventListId, member, [config.eventName])
      store.add({type: 'newsletter-approved', customer})
      return templateGenerator.generate('register-approved', {person})
    } catch (e) {
      return templateGenerator.generate('register-failed', {message: e.message || e.toString()})
    }
  }

  const router = express.Router()
  const mailChimp = new MailChimp(config.mailChimp.apiKey, fetch)

  router.get('/', makeHandler(() => getNewsletterPage(), 'send'))
  router.post('/', makeHandler(req => doInTransaction(registerForNewsletter, [req.body], true), 'send'))
  router.get('/approve/:accessCode/:hash', requireCodeAndHash({redirect: true}), makeHandler(req => doInTransaction(approveRegistration, [req.params.accessCode], true), 'send'))

  return router
}
