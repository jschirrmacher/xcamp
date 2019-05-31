const should = require('should')
const request = require('supertest')
const express = require('express')

const app = express()
const log = []
const testUser = {
  id: 4711,
  password: 'test-password',
  access_code: 'test-access-code'
}

const auth = {
  requireJWT(options) {
    return function (req, res, next) {
      log.push('auth.requireJWT')
      if (req.headers.authorization === 'test-token') {
        req.user = testUser
      }
      next()
    }
  },

  requireLogin(options) {
    return function (req, res, next) {
      log.push('auth.requireLogin')
      next()
    }
  },

  signIn() {
    return 'test-token'
  }
}

function makeHandler(handler) {
  return function (req, res) {
    res.json(handler(req))
  }
}

const readModels = {
  network: {
    getById(id) {
      if (id === 4711) {
        return Object.assign({image: 'http://my.profile/picture.jpg'}, testUser)
      }
    }
  }
}
const templateGenerator = {}
const config = {}

const router = require('./SessionRouter')({express, auth, makeHandler, templateGenerator, readModels, config})
app.use('/session', router)

describe('SessionRouter', () => {
  beforeEach(() => {
    log.length = 0
  })

  describe('GET /session', () => {
    it('should report if a user is not logged in', () => {
      return request(app)
        .get('/session')
        .expect(200)
        .expect('Content-Type', /json/)
        .then(response => {
          response.body.should.deepEqual({loggedIn: false})
        })
    })

    it('should retrieve info about the logged in user', () => {
      return request(app)
        .get('/session')
        .set('authorization', 'test-token')
        .expect(200)
        .expect('Content-Type', /json/)
        .then(response => {
          response.body.should.deepEqual({
            loggedIn: true,
            hasPasswordSet: true,
            access_code: 'test-access-code',
            profileImage: 'http://my.profile/picture.jpg'
          })
        })
    })
  })

  describe('POST /session', () => {
    it('should log in users', () => {
      return request(app)
        .post('/session')
        .field('email', 'test@example.com')
        .field('password', 'test-pasword')
        .expect(200)
        .expect('Content-Type', /json/)
        .then(response => {
          response.body.should.deepEqual({token: 'test-token'})
          log.should.deepEqual(['auth.requireLogin'])
        })
    })
  })

  describe('GET /session/logout', () => {
    it('should invalidate the user\'s session')
  })

  describe('GET /session/:accessCode/:url', () => {
    it('should show the login page')
  })
})
