module.exports = ({express, auth, makeHandler, templateGenerator, readModels, config}) => {
  function getUserInfo(user) {
    return {
      loggedIn: !!user,
      hasPasswordSet: user && !!user.password,
      access_code: user && user.access_code,
      profileImage: user && readModels.network.getById(user.id).image
    }
  }

  function loginPage(accessCode, url) {
    return templateGenerator.generate('login-page', {url, accessCode})
  }

  function login(req, res) {
    res.json({token: auth.signIn(req, res)})
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
