module.exports = (dependencies) => {
  const {
    express,
    auth,
    makeHandler,
    templateGenerator,
    baseUrl
  } = dependencies

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

  function logout(req, res) {
    auth.logout(res)
    res.redirect(baseUrl)
  }

  const router = express.Router()
  const allowAnonymous = true

  router.get('/', auth.requireJWT({allowAnonymous}), makeHandler(req => getUserInfo(req.user)))
  router.post('/', auth.requireLogin(), (req, res) => res.json({token: auth.signIn(req, res)}))
  router.get('/logout', logout)
  router.get('/:accessCode/:url', makeHandler(req => loginPage(req.params.accessCode, req.params.url), {type: 'send'}))

  return router
}
