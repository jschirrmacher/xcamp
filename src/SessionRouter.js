module.exports = ({express, auth, makeHandler, templateGenerator, config}) => {
  function getUserInfo(user) {
    return {
      loggedIn: !!user,
      hasPasswordSet: user && !!user.password,
      access_code: user && user.access_code
    }
  }

  async function loginPage(accessCode, url) {
    return templateGenerator.generate('login-page', {url, accessCode})
  }

  async function login(req, res) {
    let path = ''
    if (req.user.invoices && req.user.invoices[0].tickets && req.user.invoices[0].tickets.length > 1) {
      path = 'accounts/my'
    }
    const token = auth.signIn(req, res)
    res.json({token, path})
  }

  function logout(req, res) {
    auth.logout(res)
    res.redirect(config.baseUrl)
  }

  const router = express.Router()
  const allowAnonymous = true

  router.get('/', auth.requireJWT({allowAnonymous}), makeHandler(req => getUserInfo(req.user)))
  router.post('/', auth.requireLogin(), login)
  router.get('/logout', logout)
  router.get('/:accessCode/:url', makeHandler(req => loginPage(req.params.accessCode, req.params.url), {type: 'send'}))

  return router
}
