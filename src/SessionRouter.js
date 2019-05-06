module.exports = ({express, auth, makeHandler, templateGenerator, Model, config}) => {
  function getProfilePicture(person) {
    return Model.Network.getImageURL(person.uid, person.image)
  }

  function getUserInfo(user) {
    const person = user && (user.person && user.person[0] || user.participant && user.participant[0])
    const profileImage = user && getProfilePicture(person)

    return {
      loggedIn: !!user,
      hasPasswordSet: user && !!user.password,
      access_code: user && user.access_code,
      profileImage
    }
  }

  async function loginPage(accessCode, url) {
    return templateGenerator.generate('login-page', {url, accessCode})
  }

  async function login(req, res) {
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
