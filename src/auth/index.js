const passport = require('passport')
const LoginStrategy = require('./LoginStrategy')
const AccessCodeStrategy = require('./AccessCodeStrategy')
const CodeAndHashStrategy = require('./CodeAndHashStrategy')
const LocalStrategy = require('passport-local').Strategy
const JwtStrategy = require('passport-jwt').Strategy
require('express-session')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

module.exports = ({app, Model, dgraphClient, dgraph, readModels, store, config}) => {
  function getLoginURL(req) {
    return config.baseUrl + 'session/' + encodeURIComponent(req.params.accessCode) + '/' + encodeURIComponent(encodeURIComponent(req.originalUrl))
  }

  function tokenForUser(user) {
    return jwt.sign({sub: user.uid}, config.authSecret, {expiresIn: '24h'})
  }

  function signIn(req, res) {
    const token = tokenForUser(req.user)
    res.cookie('token', token)
    return token
  }

  function logout(res) {
    res.cookie('token', undefined)
  }

  async function setPasswordHash(customer, passwordHash, txn) {
    const mu = new dgraph.Mutation()
    await mu.setSetNquads(`<${customer.uid}> <password> "${passwordHash}" .`)
    await txn.mutate(mu)
    store.add({type: 'password-changed', userId: customer.uid, passwordHash})
  }

  async function setPassword(txn, accessCode, password) {
    const user = await Model.User.findByAccessCode(txn, accessCode)
    return new Promise((fulfil, reject) => {
      bcrypt.hash(password, 10, async (error, passwordHash) => {
        try {
          if (error) {
            reject(error)
          } else {
            await setPasswordHash(user, passwordHash, txn)
            fulfil({message: 'Passwort ist geändert'})
          }
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  async function getActualUserObject(txn, user) {
    if (user.type === 'customer') {
      return Model.Customer.get(txn, user.uid)
    } else if (user.type === 'ticket') {
      return Model.Ticket.get(txn, user.uid)
    }
    return user
  }

  passport.use(new LocalStrategy(
    async (username, password, done) => {
      const txn = dgraphClient.newTxn()
      try {
        const user = await Model.User.findByAccessCode(txn, username)
        bcrypt.compare(password, user.password, async (err, isValid) => {
          done(err, isValid ? await getActualUserObject(txn, user) : false)
        })
      } finally {
        txn.discard()
      }
    }
  ))

  passport.use(new LoginStrategy(async (email, username, password, done) => {
    const txn = dgraphClient.newTxn()
    try {
      let user
      if (email) {
        user = await Model.Customer.findByEMail(txn, email)
      } else {
        user = await Model.User.findByAccessCode(txn, username)
      }
      const hash = user.password
      user = await getActualUserObject(txn, user)
      bcrypt.compare(password, hash, async (err, isValid) => {
        done(err, isValid ? user : false)
      })
    } catch (error) {
      done(error, false)
    } finally {
      txn.discard()
    }
  }))

  passport.use(new JwtStrategy({
      jwtFromRequest: req => (req.cookies && req.cookies.token) || req.headers.authorization,
      secretOrKey: config.authSecret
    }, async (payload, done) => {
      const txn = dgraphClient.newTxn()
      try {
        const user = await Model.User.get(txn, payload.sub)
        done(null, user ? await getActualUserObject(txn, user) : false)
      } catch (error) {
        done(error, false)
      } finally {
        txn.discard()
      }
    }
  ))

  passport.use(new AccessCodeStrategy(async (accessCode, done) => {
    const txn = dgraphClient.newTxn()
    try {
      const user = await Model.User.findByAccessCode(txn, accessCode)
      if (!user.password) {
        done(null, user)
      } else {
        bcrypt.compare(password, user.password, async (err, isValid) => {
          done(err, isValid ? await getActualUserObject(txn, user) : false)
        })
      }
    } catch (error) {
      done(error, false)
    } finally {
      txn.discard()
    }
  }))

  passport.use(new CodeAndHashStrategy(async (accessCode, hash, done) => {
    const txn = dgraphClient.newTxn()
    try {
      const user = await Model.User.findByAccessCode(txn, accessCode)
      if (user && user.hash && user.hash === hash) {
        done(null, await getActualUserObject(txn, user))
      } else {
        done('invalid credentials', false)
      }
    } catch (error) {
      done(error, false)
    } finally {
      txn.discard()
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
        throw {status: 403, message: 'Not allowed'}
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
