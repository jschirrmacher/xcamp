module.exports = (dependencies) => {
  const {
    express,
    auth,
    mailChimp,
    makeHandler,
    templateGenerator,
    Model,
    mailSender,
    store
  } = dependencies

  async function getNewsletterPage() {
    return templateGenerator.generate('register-newsletter')
  }

  async function registerForNewsletter(txn, data) {
    let customer
    try {
      customer = await Model.Customer.create(txn, data)
    } catch (e) {
      if (e.status === 409) {
        customer = await Model.Customer.findByEMail(txn, data.email)
      } else {
        return templateGenerator.generate('register-failed', {message: e.message || e.toString()})
      }
    }
    try {
      const subject = 'XCamp Newsletter - Bitte bestätigen!'
      const action = 'newsletter/approve/' + customer.access_code
      const user = {
        id: customer.uid,
        firstName: customer.person[0].firstName,
        email: customer.person[0].email
      }
      await mailSender.sendHashMail('newsletter-approval-mail', user, action, subject)
      store.add({type: 'newsletter-subscription', personId: customer.person[0].uid})
      return templateGenerator.generate('register-success', {firstName: user.firstName})
    } catch (e) {
      return templateGenerator.generate('register-failed', {message: e.message || e.toString()})
    }
  }

  async function approveRegistration(txn, code) {
    try {
      const customer = await Model.Customer.findByAccessCode(txn, code)
      await mailChimp.addSubscriber(customer.person[0])
      return templateGenerator.generate('register-approved', {person: customer.person[0]})
    } catch (e) {
      return templateGenerator.generate('register-failed', {message: e.message || e.toString()})
    }
  }

  const router = express.Router()
  const allowAnonymous = true

  router.get('/', auth.requireJWT({allowAnonymous}), makeHandler(() => getNewsletterPage(), {type: 'send'}))
  router.post('/', auth.requireJWT({allowAnonymous}), makeHandler(req => registerForNewsletter(req.txn, req.body), {type: 'send', commit: true}))
  router.get('/approve/:accessCode/:hash', auth.requireJWT({allowAnonymous}), auth.requireCodeAndHash({redirect: true}), makeHandler(req => approveRegistration(req.txn, req.params.accessCode), {type: 'send', commit: true}))

  return router
}
