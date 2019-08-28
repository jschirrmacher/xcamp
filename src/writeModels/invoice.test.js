require('should')

const events = []
const listeners = []
const store = {
  listen(listener) {
    listeners.push(listener)
  },

  add(event) {
    events.push(event)
    listeners.forEach(listener => {
      listener(event, () => {}, 'new')
    })
  },

  replay() {}
}
const config = {ticketCategories: {corporate: 300}}
const readModels = {
  invoice: require('../readModels/invoice')({store, config})
}
store.listen(readModels.invoice.handleEvent)
const invoice = require('./invoice')(store, readModels, config, Math.random)

describe('invoice.js', () => {
  describe('function create', () => {
    it('should assign an invoice number for corporate tickets',  () => {
      events.length = 0
      invoice.create({type: 'corporate', payment: 'invoice'}, {id: 7})
      events[0].type.should.equal('invoice-created')
      events[0].invoice.invoiceNo.should.equal(readModels.invoice.getMaxInvoiceNo())
    })

    it('should not assign an invoice number when payed by PayPal',  () => {
      events.length = 0
      invoice.create({type: 'private', payment: 'paypal'}, {id: 7})
      events[0].type.should.equal('invoice-created')
      events[0].invoice.invoiceNo.should.equal(0)
    })

    it('should report ticket ids to event store', async () => {
      events.length = 0
      const customer = {id: 7, person: [{id: 1}]}
      invoice.create({type: 'private', payment: 'paypal', ticketCount: 2}, customer)
      events[1].type.should.equal('ticket-created')
      events[1].ticket.id.should.equal(1)
      events[2].type.should.equal('ticket-created')
      events[2].ticket.id.should.equal(2)
    })
  })
})
