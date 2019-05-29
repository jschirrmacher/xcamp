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

function expectResult(status, json) {
  return res = {
    status: wrap(status),
    json: wrap(json),
    cookie(name, value) {
      name.should.equal('token')
      jwt.verify(value, config.authSecret, (err, decoded) => {
        should(err).be.null()
        decoded.should.have.properties(['iat', 'exp'])
      })
    }
  }

  function wrap(func) {
    return data => {
      func(data)
      return res
    }
  }
}

describe('auth', () => {
  it('should authenticate with e-mail and password', done => {
    const middleware = auth.requireLogin()
    const req = {body: {email: 'test@example.com', password: 'test-pwd'}}
    const res = expectResult(code => code.should.equal(200))
    middleware(req, res, err => {
      should(err).be.undefined()
      req.user.should.have.property('id')
      req.user.id.should.equal(4711)
      done()
    })
  })

  it('should not authenticate with e-mail and wrong password', done => {
    const middleware = auth.requireLogin()
    const req = {body: {email: 'test@example.com', password: 'wrong-pwd'}}
    const res = expectResult(
      code => code.should.equal(401),
      data => data.should.deepEqual({error: 'Not authenticated'})
    )
    middleware(req, res, () => should().fail())
    done()
  })

  it('should authenticate with access code and hash', done => {
    const middleware = auth.requireCodeAndHash()
    const req = {body: {email: 'test3@example.com'}, params: {accessCode: 'test-access', hash: 'test-hash'}}
    const res = expectResult(code => code.should.equal(200))
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
    const res = expectResult(code => code.should.equal(200))
    middleware(req, res, err => {
      should(err).be.undefined()
      req.user.should.have.property('id')
      req.user.id.should.equal(4712)
      done()
    })
  })
})
