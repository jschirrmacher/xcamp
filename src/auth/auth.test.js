/*eslint-env mocha*/
const should = require('should')
const jwt = require('jsonwebtoken')

const app = {
  use() {}
}
const Model = {}
const dgraphClient = {
  newTxn() {
    return {
      discard() {
      }
    }
  }
}
const users = [
  {id: 4711, email: 'test@example.com', access_code: 'test-access-1', password: '$2a$10$5cblct/kPaZQ5uh9jNKIVu8.oGiOPDPGB4iZRdNp0E1miYl6jTqXm'},
  {id: 4712, email: 'test2@example.com'},
  {id: 4713, email: 'test3@example.com', access_code: 'test-access', hash: 'test-hash'}
]
const readModels = {
  user: {
    getByEMail(email) {
      const user = users.find(user => user.email === email)
      if (user) {
        return user
      }
      throw `No user found with this e-mail address`
    },
    getByAccessCode(code) {
      const user = users.find(user => user.access_code === code)
      if (user) {
        return user
      }
      throw `No user found with this access code`
    },
    getById(id) {
      const user = users.find(user => user.id === id)
      if (user) {
        return user
      }
      throw `No user found with this id`
    },
    adminIsDefined: true
  }
}

const storedData = []
const store = {
  add(entry) {
    storedData.push(entry)
  }
}

const config = {
  authSecret: 'secret-key'
}

const auth = require('.')({app, Model, dgraphClient, readModels, store, config})

function expect(expected) {
  if (typeof expected === 'function') {
    return expected
  } else {
    return data => data.should.deepEqual(expected)
  }
}

function checkCookie(name, value) {
  name.should.equal('token')
  jwt.verify(value, config.authSecret, (err, decoded) => {
    should(err).be.null()
    decoded.should.have.properties(['iat', 'exp'])
  })
}

function makeExpectedResult(expectedValues = {}) {
  const res = {
    status: wrap(expectedValues, 'status'),
    json: wrap(expectedValues, 'json'),
    cookie: wrap(expectedValues, 'cookie'),
    called: {status: false, json: false, cookie: false}
  }

  function wrap(expectedValues, name) {
    const func = expectedValues[name] ? expect(expectedValues[name]) : () => {}
    return (...args) => {
      res.called[name] = true
      func(...args)
      return res
    }
  }

  return res
}

describe('auth', () => {
  describe('requireLogin', () => {
    it('should authenticate with e-mail and password', done => {
      const middleware = auth.requireLogin()
      const req = {body: {email: 'test@example.com', password: 'test-pwd'}}
      const res = makeExpectedResult()
      middleware(req, res, err => {
        should(err).be.undefined()
        req.user.should.have.property('id')
        req.user.id.should.equal(4711)
        done()
      })
    })

    it('should generate a JWT if authenticated with e-mail and password', done => {
      const middleware = auth.requireLogin()
      const req = {body: {email: 'test@example.com', password: 'test-pwd'}}
      const res = makeExpectedResult({cookie: checkCookie})
      middleware(req, res, () => {
        res.called.cookie.should.be.true()
        done()
      })
    })

    it('should not authenticate with e-mail and wrong password', done => {
      const middleware = auth.requireLogin()
      const req = {body: {email: 'test@example.com', password: 'wrong-pwd'}}
      const res = makeExpectedResult({status: 401, json: {error: 'Not authenticated'}})
      middleware(req, res, () => should().fail())
      done()
    })
  })

  describe('requireCodeAndHash', () => {
    it('should authenticate with access code and hash', done => {
      const middleware = auth.requireCodeAndHash()
      const req = {params: {accessCode: 'test-access', hash: 'test-hash'}}
      const res = makeExpectedResult()
      middleware(req, res, err => {
        should(err).be.undefined()
        req.user.should.have.property('id')
        req.user.id.should.equal(4713)
        done()
      })
    })

    it('should not authenticate without access code', done => {
      const middleware = auth.requireCodeAndHash()
      const req = {params: {hash: 'test-hash'}}
      const res = makeExpectedResult({status: 401, json: {error: 'Not authenticated'}})
      middleware(req, res, () => should().fail())
      done()
    })

    it('should not authenticate without hash', done => {
      const middleware = auth.requireCodeAndHash()
      const req = {params: {accessCode: 'test-access'}}
      const res = makeExpectedResult({status: 401, json: {error: 'Not authenticated'}})
      middleware(req, res, () => should().fail())
      done()
    })

    it('should not authenticate if wrong access code is provided', done => {
      const middleware = auth.requireCodeAndHash()
      const req = {params: {accessCode: 'wrong-access', hash: 'test-hash'}}
      const res = makeExpectedResult({status: 401, json: {error: 'Not authenticated'}})
      middleware(req, res, () => should().fail())
      done()
    })

    it('should not authenticate if wrong hash is provided', done => {
      const middleware = auth.requireCodeAndHash()
      const req = {params: {accessCode: 'test-access', hash: 'wrong-hash'}}
      const res = makeExpectedResult({status: 401, json: {error: 'Not authenticated'}})
      middleware(req, res, () => should().fail())
      done()
    })
  })

  describe('requireJWT', () => {
    it('should authenticate with JWT in header', done => {
      const middleware = auth.requireJWT()
      const authorization = jwt.sign({sub: 4712}, config.authSecret, {expiresIn: '24h'})
      const req = {body: {email: 'test3@example.com'}, headers: {authorization}}
      const res = makeExpectedResult()
      middleware(req, res, err => {
        should(err).be.undefined()
        req.user.should.have.property('id')
        req.user.id.should.equal(4712)
        done()
      })
    })

    it('should authenticate with JWT in cookie', done => {
      const middleware = auth.requireJWT()
      const token = jwt.sign({sub: 4712}, config.authSecret, {expiresIn: '24h'})
      const req = {body: {email: 'test3@example.com'}, cookies: {token}}
      const res = makeExpectedResult()
      middleware(req, res, err => {
        should(err).be.undefined()
        req.user.should.have.property('id')
        req.user.id.should.equal(4712)
        done()
      })
    })
  })

  describe('requireCodeOrAuth', () => {
    it('should authenticate with access code if password is not set', done => {
      const middleware = auth.requireCodeOrAuth()
      const req = {
        body: {email: 'test3@example.com'},
        params: {accessCode: 'test-access', hash: 'test-hash'},
        headers: {}
      }
      const res = makeExpectedResult()
      middleware(req, res, err => {
        should(err).be.undefined()
        req.user.should.have.property('id')
        req.user.id.should.equal(4713)
        done()
      })
    })

    it('should not authenticate with access code if password is set', done => {
      const middleware = auth.requireCodeOrAuth()
      const req = {
        body: {email: 'test3@example.com'},
        params: {accessCode: 'test-access-1', hash: 'test-hash'},
        headers: {}
      }
      const res = makeExpectedResult({status: 401, json: {error: 'Not authenticated'}})
      middleware(req, res, () => should().fail())
      done()
    })

    it('should authenticate with JWT token', done => {
      const middleware = auth.requireCodeOrAuth()
      const token = jwt.sign({sub: 4712}, config.authSecret, {expiresIn: '24h'})
      const req = {body: {email: 'test3@example.com'}, cookies: {token}}
      const res = makeExpectedResult()
      middleware(req, res, err => {
        should(err).be.undefined()
        req.user.should.have.property('id')
        req.user.id.should.equal(4712)
        done()
      })
    })
  })

  describe('requireAdmin', () => {
    it('should require a user to be admin', done => {
      readModels.user.adminIsDefined = true
      const middleware = auth.requireAdmin()
      const req = {user: {id: 4711}}
      const res = makeExpectedResult({status: 403, message: 'Not allowed'})
      middleware(req, res, err => {
        err.should.deepEqual({status: 403, message: 'Not allowed'})
        done()
      })
    })

    it('should allow access for admins', done => {
      readModels.user.adminIsDefined = true
      const middleware = auth.requireAdmin()
      const req = {user: {id: 4712, isAdmin: true}}
      const res = makeExpectedResult()
      middleware(req, res, err => {
        should(err).be.undefined()
        done()
      })
    })

    it('should allow access if no admin is defined', done => {
      readModels.user.adminIsDefined = false
      const middleware = auth.requireAdmin()
      const req = {user: {id: 4711}}
      const res = makeExpectedResult()
      middleware(req, res, err => {
        should(err).be.undefined()
        readModels.user.adminIsDefined = true
        done()
      })
    })
  })

  it('should clear the cookie if logged out', done => {
    let cookieIsCleared = false
    auth.logout({
      cookie(name, value) {
        name.should.equal('token')
        should(value).be.undefined()
        cookieIsCleared = true
      }
    })
    cookieIsCleared.should.be.true()
    done()
  })

  it('should change the password', async () => {
    storedData.length = 0
    const user = readModels.user.getById(4713)
    const result = await auth.setPassword(user.access_code, 'new-password')
    result.should.deepEqual({message: 'Passwort ist geändert'})
    storedData.length.should.equal(1)
    storedData[0].should.have.properties(['type', 'userId', 'passwordHash'])
    storedData[0].type.should.equal('password-changed')
    storedData[0].userId.should.equal(4713)
    storedData[0].passwordHash.should.startWith('$2a$10$')
  })
})
