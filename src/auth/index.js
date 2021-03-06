const passport = require('passport')
const LoginStrategy = require('./LoginStrategy')
const AccessCodeStrategy = require('./AccessCodeStrategy')
const CodeAndHashStrategy = require('./CodeAndHashStrategy')
const JwtStrategy = require('passport-jwt').Strategy
require('express-session')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

module.exports = ({app, readModels, store, config}) => {
  const secretOrKey = config.authSecret

  function getLoginURL(req) {
    return config.baseUrl + 'session/' + encodeURIComponent(req.params.accessCode) + '/' + encodeURIComponent(encodeURIComponent(req.originalUrl))
  }

  function signIn(req, res) {
    const token = jwt.sign({sub: req.user.id}, config.authSecret, {expiresIn: '24h'})
    res.cookie('token', token)
    return token
  }

  function logout(res) {
    res.cookie('token', '')
  }

  function jwtFromRequest(req) {
    return (req.cookies && req.cookies.token) || req.headers.authorization
  }

  async function setPassword(accessCode, password) {
    const user = readModels.user.getByAccessCode(accessCode)
    const passwordHash = await bcrypt.hash(password, 10)
    store.add({type: 'password-changed', userId: user.id, passwordHash})
    return {message: 'Passwort ist geändert'}
  }

  passport.use(new LoginStrategy(async (email, username, password, done) => {
    try {
      const user = email ? readModels.user.getByEMail(email) : readModels.user.getByAccessCode(username)
      bcrypt.compare(password, user.password, async (err, isValid) => {
        done(err, isValid ? user : false)
      })
    } catch (error) {
      done(error, false)
    }
  }))

  passport.use(new JwtStrategy({jwtFromRequest, secretOrKey}, async (payload, done) => {
    try {
      const user = readModels.user.getById(payload.sub)
      done(null, user)
    } catch (error) {
      done(error, false)
    }
  }))

  passport.use(new AccessCodeStrategy(async (accessCode, done) => {
    try {
      const user = readModels.user.getByAccessCode(accessCode)
      if (!user.password) {
        done(null, user)
      } else {
        done('password is set so you cannot login without a hash code', false)
      }
    } catch (error) {
      done(error, false)
    }
  }))

  passport.use(new CodeAndHashStrategy(async (accessCode, hash, done) => {
    try {
      const user = readModels.user.getByAccessCode(accessCode)
      if (user && user.hash && user.hash === hash) {
        done(null, user)
      } else {
        done('invalid credentials', false)
      }
    } catch (error) {
      done(error, false)
    }
  }))

  function authenticate(type, options = {}) {
    return function (req, res, next) {
      passport.authenticate(type, {session: false}, (err, user) => {
        if (err) {
          return next(err)
        } else if (!req.user && !user && !options.allowAnonymous) {
          if (options.redirect) {
            res.redirect(getLoginURL(req))
          } else {
            res.status(401).json({error: 'Not authenticated'})
          }
        } else if (!req.user && user) {
          req.user = user
          signIn(req, res)
          next()
        } else {
          next()
        }
      })(req, res, next)
    }
  }

  app.use(passport.initialize())
  app.use(passport.session())

  const requireCodeOrAuth = (options = {}) => authenticate(['jwt', 'access_code'], options)
  const requireCodeAndHash = (options = {}) => authenticate('codeNHash', options)
  const requireJWT = (options = {}) => authenticate('jwt', options)
  const requireLogin = (options = {}) => authenticate('login', options)

  function requireAdmin() {
    return function(req, res, next) {
      if ((!req.user || !req.user.isAdmin) && readModels.user.adminIsDefined) {
        next({status: 403, message: 'Not allowed'})
      } else {
        next()
      }
    }
  }

  return {
    authenticate,
    signIn,
    setPassword,
    logout,

    requireCodeOrAuth,
    requireCodeAndHash,
    requireJWT,
    requireLogin,
    requireAdmin
  }
}
