/*eslint-env mocha*/
require('should')
const request = require('supertest')
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

const templateGenerator = {
  generate(page, params) {
    return {page, params}
  }
}
const makeHandler = require('../lib/makeHandler')({auth: {}, templateGenerator, logger: console})
const Model = {
  Ticket: {
    buy() {
      return { buyIsCalled: true }
    }
  }
}
const readModels = {}
const config = {
  ticketSaleActive: true,
  ticketCategories: {}
}
const router = require('./TicketRouter')({express, makeHandler, templateGenerator, Model, readModels, config})
app.use(router)

describe('TicketRouter', () => {
  describe('Ticket page', () => {
    it('should be rendered', async () => {
      const result = await request(app).get('/abc').expect(200)
      result.body.page.should.equal('buy-ticket')
    })

    it('should mention the correct event name', async () => {
      const result = await request(app).get('/abc')
      result.body.params.eventName.should.equal('abc')
    })
  })

  describe('ticket buy', () => {
    it('should call the ticket write handler buy() function', async () => {
      const result = await request(app).post('/abc')
        .send({email: 'test@example.com'})
      
      result.status.should.equal(200)
      result.body.buyIsCalled.should.be.true
    })
  })
})
