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
const readModels = {
  invoice: require('./readModels/invoice')({store})
}
store.listen(readModels.invoice.handleEvent)
const invoice = require('./invoice')(store, readModels)

describe('invoice.js', () => {
  describe('function create', () => {
    it('should assign an invoice number for corporate tickets',  () => {
      events.length = 0
      invoice.create({type: 'corporate', payment: 'invoice'}, {uid: 7})
      events[0].type.should.equal('invoice-created')
      events[0].invoice.invoiceNo.should.equal(readModels.invoice.getMaxInvoiceNo())
    })

    it('should not assign an invoice number when payed by PayPal',  () => {
      events.length = 0
      invoice.create({type: 'private', payment: 'paypal'}, {uid: 7})
      events[0].type.should.equal('invoice-created')
      events[0].invoice.invoiceNo.should.equal(0)
    })

    it('should report ticket ids to event store', async () => {
      events.length = 0
      invoice.create({type: 'private', payment: 'paypal'}, {uid: 7})
      await invoice.addTicket(events[0].invoice, {participant: {uid: 77}})
      await invoice.addTicket(events[0].invoice, {participant: {uid: 88}})
      events[1].type.should.equal('ticket-created')
      events[1].ticket.id.should.equal(1)
      events[2].type.should.equal('ticket-created')
      events[2].ticket.id.should.equal(2)
    })
  })
})
