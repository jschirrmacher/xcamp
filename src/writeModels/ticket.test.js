
require('should')

const spy = []
const Model = {
  Customer: {
    create(data) {
      spy.push('Customer created')
      return {id: 4712, personId: data.personId}
    }
  },
  Invoice: {
    create(data, customer) {
      spy.push('Invoice created for customer #' + customer.id)
      return {id: 4713, customer, payment: data.payment}
    }
  }
}
const mailSender = {}
const templateGenerator = {}
const Payment = {
  getPaymentURL() {
    return 'https://paypal.com'
  }
}
const mailChimp = {
  async addSubscriber() {
    spy.push(`Added to MailChimp list`)
  },
  async addTags(data, tagList) {
    spy.push(`Added tags ${tagList.map(t => `'${t}'`).join(',')}`)
  }
}
const rack = {}
const store = {
  add(event) {
    spy.push(`Added ${event.type} to store`)
  }
}
const readModels = {
  coupon: {
    getByAccessCode(code) {
      return code === 42 ? { category: 'private' } : null
    }
  },
  user: {
    getById(id) {
      return {id}
    }
  }
}
const config = {
  eventName: 'test-event'
}

const ticket = require('./ticket')(Model, mailSender, templateGenerator, Payment, mailChimp, rack, store, readModels, config)

function createTicket(overwrite = {}) {
  return ticket.buy(Object.assign({tos_accepted: true, code: 42, type: 'private', payment: 'paypal'}, overwrite))
}

describe('Ticket model', () => {
  beforeEach(() => spy.length = 0)

  describe('buy function', () => { 
    it('should check for TOS to be confirmed', async () => {
      createTicket({tos_accepted: false}).should.be.rejectedWith('You need to accept the terms of service')
    })

    it('should accept valid coupon codes', async () => {
      createTicket({code: 42}).should.not.be.rejected
    })

    it('should reject invalid coupon codes', async () => {
      createTicket({code: 666}).should.be.rejectedWith('Reduced tickets require a valid coupon code')
      createTicket({type: 'corporate'}).should.be.rejectedWith('Ticket category doesn\'t match coupon code')
    })

    it('should invalidate coupons', async () => {
      await createTicket()
      spy.should.containEql('Added coupon-invalidated to store')
    })

    it('should redirect to paypal', async () => {
      const result = await createTicket()
      result.isRedirection.should.be.true
      result.url.should.equal('https://paypal.com')
    })

    it('should create a customer', async () => {
      await createTicket()
      spy.should.containEql('Customer created')
    })

    it('should create an invoice', async () => {
      await createTicket()
      spy.should.containEql('Invoice created for customer #4712')
    })

    it('should subscribe user to newsletter', async () => {
      await createTicket()
      spy.should.containEql('Added to MailChimp list')
    })

    it('should assign the current event as tag to MailChimp', async () => {
      await createTicket()
      spy.should.containEql('Added tags \'test-event\'')
    })
  })
})
