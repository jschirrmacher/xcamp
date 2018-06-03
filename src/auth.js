const passport = require('passport')
const util = require('util')

module.exports = (app, Person, Customer, Ticket, dgraphClient, dgraph, secret, getLoginURL) => {
  require('express-session')
  const bcrypt = require('bcrypt')
  const LocalStrategy = require('passport-local').Strategy
  const jwt = require('jsonwebtoken')
  const JwtStrategy = require('passport-jwt').Strategy

  function LoginStrategy(verify) {
    passport.Strategy.call(this)
    this.name = 'login'
    this.verify = verify
  }

  util.inherits(LoginStrategy, passport.Strategy)

  LoginStrategy.prototype.authenticate = async function (req) {
    if (!(req.body.email || req.body.username) && !req.body.password) {
      this.fail('no credentials provided')
    } else {
      this.verify(req.body.email, req.body.username, req.body.password, (err, info) => {
        if (err) {
          this.fail(err)
        } else {
          this.success(info)
        }
      })
    }
  }

  function AccessCodeStrategy(verify) {
    passport.Strategy.call(this)
    this.name = 'access_code'
    this.verify = verify
  }

  util.inherits(AccessCodeStrategy, passport.Strategy)

  AccessCodeStrategy.prototype.authenticate = async function (req) {
    if (!req.params.accessCode && !req.cookies.accessCode) {
      this.fail('no access code provided')
    } else {
      this.verify(req.params.accessCode || req.cookies.accessCode, (err, info) => {
        if (err) {
          this.fail(err)
        } else {
          this.success(info)
        }
      })
    }
  }

  function CodeAndHashStrategy(verify) {
    passport.Strategy.call(this)
    this.name = 'codeNHash'
    this.verify = verify
  }

  util.inherits(CodeAndHashStrategy, passport.Strategy)

  CodeAndHashStrategy.prototype.authenticate = async function (req) {
    if (!req.params.accessCode || !req.params.hash) {
      this.fail('access code or hash not provided')
    } else {
      this.verify(req.params.accessCode, req.params.hash, (err, info) => {
        if (err) {
          this.fail(err)
        } else {
          this.success(info)
        }
      })
    }
  }

  function tokenForUser(user) {
    return jwt.sign({sub: user.uid}, secret, {expiresIn: '24h'})
  }

  function signIn(req, res) {
    const token = tokenForUser(req.user)
    res.cookie('token', token)
    return token
  }

  async function setPasswordHash(customer, passwordHash, txn) {
    const mu = new dgraph.Mutation()
    await mu.setSetNquads(`<${customer.uid}> <password> "${passwordHash}" .`)
    await txn.mutate(mu)
  }

  async function setPassword(txn, accessCode, password) {
    const customer = await Customer.findByAccessCode(txn, accessCode)
    return new Promise((fulfil, reject) => {
      bcrypt.hash(password, 10, async (error, passwordHash) => {
        try {
          if (error) {
            reject(error)
          } else {
            await setPasswordHash(customer, passwordHash, txn)
            fulfil('Passwort ist geändert')
          }
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  passport.use(new LocalStrategy(
    async (username, password, done) => {
      const txn = dgraphClient.newTxn()
      try {
        const customer = await Customer.findByAccessCode(txn, username)
        bcrypt.compare(password, customer.password, (err, isValid) => {
          done(err, isValid ? {uid: customer.uid} : false)
        })
      } finally {
        txn.discard()
      }
    }
  ))

  passport.use(new LoginStrategy(async (email, username, password, done) => {
    const txn = dgraphClient.newTxn()
    try {
      let customer
      if (email) {
        customer = await Customer.findByEMail(txn, email)
      } else {
        customer = await Customer.findByAccessCode(txn, username)
      }
      bcrypt.compare(password, customer.password, (err, isValid) => {
        done(err, isValid ? {uid: customer.uid} : false)
      })
    } catch (error) {
      done(error, false)
    } finally {
      txn.discard()
    }
  }))

  passport.use(new JwtStrategy({
      jwtFromRequest: req => (req.cookies && req.cookies.token) || req.headers.authorization,
      secretOrKey: secret
    }, async (payload, done) => {
      const txn = dgraphClient.newTxn()
      try {
        const customer = await Customer.get(txn, payload.sub)
        done(null, customer || false)
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
      const customer = await Customer.findByAccessCode(txn, accessCode)
      if (!customer.password) {
        done(null, customer)
      } else {
        bcrypt.compare(password, customer.password, (err, isValid) => {
          done(err, isValid ? customer : false)
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
      const customer = await Customer.findByAccessCode(txn, accessCode)
      if (customer.hash && customer.hash === hash) {
        done(null, customer)
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

  return {
    authenticate,
    signIn,
    setPassword
  }
}
