const should = require('should')
const jwt = require('jsonwebtoken')

const app = {
  use() {}
}
const Model = {}
const dgraphClient = {
  newTxn() {
    return {
      discard() {}
    }
  }
}
const users = [
  {id: 4711, email: 'test@example.com', password: '$2a$10$5cblct/kPaZQ5uh9jNKIVu8.oGiOPDPGB4iZRdNp0E1miYl6jTqXm'},
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
    }
  }
}
const store = {}
const config = {
  authSecret: 'secret-key'
}

const auth = require('.')({app, Model, dgraphClient, readModels, store, config})

const emptyFunc = () => {}
const expect = expected => data => data.should.deepEqual(expected)

function expectValidCookie() {
  return (name, value) => {
    name.should.equal('token')
    jwt.verify(value, config.authSecret, (err, decoded) => {
      should(err).be.null()
      decoded.should.have.properties(['iat', 'exp'])
    })
  }
}

function makeExpectedResult({status = 200, json = emptyFunc, cookie = emptyFunc}) {
  return res = {
    status: wrap(status, 'status'),
    json: wrap(json, 'json'),
    cookie: wrap(cookie, 'cookie'),
    called: {status: false, json: false, cookie: false}
  }

  function wrap(func, called) {
    return (...args) => {
      res.called[called] = true
      func(...args)
      return res
    }
  }
}

describe('auth', () => {
  it('should authenticate with e-mail and password', done => {
    const middleware = auth.requireLogin()
    const req = {body: {email: 'test@example.com', password: 'test-pwd'}}
    const res = makeExpectedResult({status: expect(200)})
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
    const res = makeExpectedResult({cookie: expectValidCookie()})
    middleware(req, res, err => {
      res.called.cookie.should.be.true()
      done()
    })
  })

  it('should not authenticate with e-mail and wrong password', done => {
    const middleware = auth.requireLogin()
    const req = {body: {email: 'test@example.com', password: 'wrong-pwd'}}
    const res = makeExpectedResult({
      status: expect(401),
      json: expect({error: 'Not authenticated'})
    })
    middleware(req, res, () => should().fail())
    done()
  })

  it('should authenticate with access code and hash', done => {
    const middleware = auth.requireCodeAndHash()
    const req = {body: {email: 'test3@example.com'}, params: {accessCode: 'test-access', hash: 'test-hash'}}
    const res = makeExpectedResult({status: expect(200)})
    middleware(req, res, err => {
      should(err).be.undefined()
      req.user.should.have.property('id')
      req.user.id.should.equal(4713)
      done()
    })
  })

  it('should authenticate with JWT', done => {
    const middleware = auth.requireJWT()
    const authorization = jwt.sign({sub: 4712}, config.authSecret, {expiresIn: '24h'})
    const req = {body: {email: 'test3@example.com'}, headers: {authorization}}
    const res = makeExpectedResult({status: expect(200)})
    middleware(req, res, err => {
      should(err).be.undefined()
      req.user.should.have.property('id')
      req.user.id.should.equal(4712)
      done()
    })
  })
})
