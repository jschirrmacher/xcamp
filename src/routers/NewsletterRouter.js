module.exports = (dependencies) => {
  const {
    express,
    auth,
    mailChimp,
    makeHandler,
    templateGenerator,
    Model,
    mailSender,
    store,
    readModels
  } = dependencies

  function getNewsletterPage() {
    return templateGenerator.generate('register-newsletter')
  }

  async function registerForNewsletter(data) {
    const person = await Model.Person.getOrCreate(data)
    const subject = 'XCamp Newsletter - Bitte bestätigen!'
    const action = 'newsletter/approve/' + person.access_code
    mailSender.sendHashMail('mail/newsletter-approval-mail', person, action, subject)
    store.add({type: 'newsletter-subscription', personId: person.id})
    return templateGenerator.generate('register-success', person)
  }

  async function approveRegistration(code) {
    const person = readModels.person.getByAccessCode(code, true)
    await mailChimp.addSubscriber(person)
    return templateGenerator.generate('register-approved', person)
  }

  const router = express.Router()
  const allowAnonymous = true

  router.get('/', auth.requireJWT({allowAnonymous}), makeHandler(() => getNewsletterPage(), {type: 'send'}))
  router.post('/', auth.requireJWT({allowAnonymous}), makeHandler(req => registerForNewsletter(req.body), {type: 'send'}))
  router.get('/approve/:accessCode/:hash', auth.requireJWT({allowAnonymous}), auth.requireCodeAndHash({redirect: true}), makeHandler(req => approveRegistration(req.params.accessCode), {type: 'send'}))

  return router
}
