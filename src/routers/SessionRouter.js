const md5 = require('md5')

const oauthState = md5(Math.random())

module.exports = ({express, auth, makeHandler, templateGenerator, readModels, config}) => {
  function getUserInfo(user) {
    return {
      loggedIn: !!user,
      hasPasswordSet: user && !!user.password,
      access_code: user && user.access_code,
      profileImage: readModels.network.getImageURL(user && readModels.network.getById(user.personId))
    }
  }

  function loginPage(accessCode, url) {
    const params = [
      'layout=embedded',
      'client_id=' + config.chat.oauth.client_id,
      'reponse_type=cpde',
      'state=' + oauthState,
      'redirect_uri=' + config.baseUrl + 'session/oauth'
    ]
    const oauth = config.chat.url + 'oauth/authorize?' + params.join('&')
    return templateGenerator.generate('login-page', {url, accessCode, oauth})
  }

  async function login(req, res) {
    if (req.query.state && req.query.state !== oauthState) {
      res.send(templateGenerator.generate('exception-occured', {message: 'Invalid state in OAuth flow'}))
      res.redirect(config.baseUrl + 'exception-occured/login?message=invalid_state_in_oauth_flow')
    } else if (req.query.code) {
      const body = JSON.stringify({
        grant_type: 'authorization_code',
        code: req.query.code,
        redirect_uri: config.baseUrl + 'session/oauth',
        client_id: config.chat.oauth.client_id,
        client_secret: config.chat.oauth.client_secret
      })
      const headers = {'content-type': 'application/json'}
      const tokenResult = await fetch(config.chat.url + 'oauth/token', {method: 'POST', headers, body})
      const content = await tokenResult.json()
      const meResult = await fetch(config.chat.url + 'api/v1/me', {headers: {Authorization: 'Bearer ' + content.access_token}})
      const me = await meResult.json()
      res.cookie('token', auth.signIn({
        id: me._id,
        accessToken: content.access_token,
        refreshToken: content.refresh_token
      }))
      res.send('<script>parent.location.href = "' + config.baseUrl + 'netvis"</script>')
    } else {
      res.json({token: auth.signIn(req, res)})
    }
  }

  function logout(req, res) {
    auth.logout(res)
    res.redirect(config.baseUrl)
  }

  const router = express.Router()
  const allowAnonymous = true

  router.get('/', auth.requireJWT({allowAnonymous}), makeHandler(req => getUserInfo(req.user)))
  router.post('/', auth.requireLogin(), login)
  router.get('/login', makeHandler(() => loginPage(), {type: 'send'}))
  router.get('/oauth', login)
  router.get('/logout', logout)
  router.get('/:accessCode/:url', makeHandler(req => loginPage(req.params.accessCode, req.params.url), {type: 'send'}))

  return router
}
