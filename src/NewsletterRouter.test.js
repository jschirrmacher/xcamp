/*eslint-env mocha*/
require('should')
const request = require('supertest')
const express = require('express')
const makeHandler = require('./lib/makeHandler')

const app = express()
const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

const log = []
const auth = {
  requireJWT: () => (req, res, next) => {
    log.push({func: 'auth.requireJWT', authHeader: req.headers.autorization})
    next()
  },
  requireCodeAndHash: () => (req, res, next) => {
    log.push({func: 'auth.requireCodeAndHash', params: req.params})
    next()
  }
}
const templateGenerator = {
  generate: template => template
}
const Model = {
  Person: {
    getOrCreate(data) {
      log.push({func: 'Person.getOrCreate', data})
      data.access_code = 'access_code'
      return data
    }
  }
}
const mailSender = {
  sendHashMail(...params) {
    log.push({func: 'sendHashMail', params})
  }
}
const store = {
  add(event) {
    log.push({func: 'store.add', event})
  }
}
const readModels = {
  person: {
    getByAccessCode(code) {
      return {
        name: 'Test person'
      }
    }
  }
}
const mailChimp = {
  addSubscriber(data) {
    log.push({func: 'mailChimp.addSubscriber', data})
  }
}

const router = require('./NewsletterRouter')({express, auth, makeHandler, templateGenerator, Model, mailSender, store, readModels, mailChimp})
app.use('/newsletter', router)

describe('NewsletterRouter', () => {
  describe('GET /newsletter', () => {
    it('should generate a registration form', () => {
      return request(app)
        .get('/newsletter')
        .expect(200)
        .expect('Content-Type', /^text\/html/)
        .then(response => {
          response.text.should.equal('register-newsletter')
        })
    })
  })

  describe('POST /newsletter', () => {
    before(() => {
      log.length = 0
      this.OUT = request(app).post('/newsletter').send({email: 'test@example.com'})
    })

    it('should show a success page', () => {
      this.OUT
        .expect(200)
        .expect('Content-Type', /^text\/html/)
        .then(response => {
          response.text.should.equal('register-success')
        })
    })

    it('should send an e-mail', () => {
      this.OUT.then(() => {
        should(log.some(e => e.func === 'sendHashMail')).not.be.null()
      })
    })

    it('e-mail should contain an approval link', () => {
      this.OUT.then(() => {
        log.find(e => e.func === 'sendHashMail').params[1].access_code.should.equal('access_code')
      })
    })

    it('create a person entry', () => {
      this.OUT.then(() => {
        should(log.find(e => e.func === 'Person.getOrCreate')).not.be.null()
      })
    })
  })

  describe('GET /newsletter/approve/:access_code/:hash', () => {
    before(() => {
      log.length = 0
      this.OUT = request(app).get('/newsletter/approve/access_code/hash')
    })

    it('should show a success page', () => {
      this.OUT
        .expect(200)
        .expect('Content-Type', /^text\/html/)
        .then(response => {
          response.text.should.equal('register-approved')
        })
    })

    it('should add the person to MailChimp', () => {
      this.OUT.then(() => {
        log.find(e => e.func === 'mailChimp.addSubscriber').data.should.deepEqual({name: 'Test person'})
      })
    })
  })
})
