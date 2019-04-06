module.exports = (dependencies) => {
  const {
    express,
    auth,
    mailChimp,
    makeHandler,
    templateGenerator,
    Customer,
    mailSender,
    store
  } = dependencies

  async function getNewsletterPage() {
    return templateGenerator.generate('register-newsletter')
  }

  async function registerForNewsletter(txn, data) {
    let customer
    try {
      customer = await Customer.create(txn, data)
    } catch (e) {
      if (e.status === 409) {
        customer = await Customer.findByEMail(txn, data.email)
      } else {
        return templateGenerator.generate('register-failed', {message: e.message || e.toString()})
      }
    }
    try {
      const subject = 'XCamp Newsletter - Bitte bestätigen!'
      const action = 'newsletter/approve/' + customer.access_code
      await mailSender.sendHashMail(txn, 'newsletter-approval-mail', customer, action, subject)
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

  router.get('/', makeHandler(() => getNewsletterPage(), {type: 'send'}))
  router.post('/', makeHandler(req => registerForNewsletter(req.txn, req.body), {type: 'send', txn: true}))
  router.get('/approve/:accessCode/:hash', auth.requireCodeAndHash({redirect: true}), makeHandler(req => approveRegistration(req.txn, req.params.accessCode), {type: 'send', commit: true}))

  return router
}
