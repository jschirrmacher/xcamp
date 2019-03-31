module.exports = (dependencies) => {
  const {
    express,
    auth,
    mailChimp,
    eventName,
    makeHandler,
    doInTransaction,
    templateGenerator,
    Customer,
    sendHashMail,
    store
  } = dependencies

  async function getNewsletterPage() {
    return templateGenerator.generate('register-newsletter', {eventName})
  }

  async function registerForNewsletter(txn, data) {
    try {
      const customer = await Customer.create(txn, data)
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
      await mailChimp.addSubscriber(customer)
      return templateGenerator.generate('register-approved', {person: customer.person[0]})
    } catch (e) {
      return templateGenerator.generate('register-failed', {message: e.message || e.toString()})
    }
  }

  const router = express.Router()

  router.get('/', makeHandler(() => getNewsletterPage(), 'send'))
  router.post('/', makeHandler(req => doInTransaction(registerForNewsletter, [req.body], true), 'send'))
  router.get('/approve/:accessCode/:hash', auth.requireCodeAndHash({redirect: true}), makeHandler(req => doInTransaction(approveRegistration, [req.params.accessCode], true), 'send'))

  return router
}
