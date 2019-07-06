require('should')

const events = []
const dgraphClient = {}
class Mutation {
  setSetJson() {}
  setSetNquads() {}
}
const dgraph = {
  Mutation
}
const Model = {}
const store = {
  add(event) {
    events.push(event)
  }
}
const invoice = require('./invoice')(dgraphClient, dgraph, Model, store)

const txn = {
  query(str) {
    return {
      getJson() {
        if (str.match(/max\(val\(d\)\)}}/)) {
          return {
            me: [{'max(val(d))': 4710}]
          }
        } else if (str.match(/^{ invoice\(/)) {
          return {
            invoice: [{
              tickets: [
                {id: 999, participant: [{uid: 42}]},
                {id: 1000, participant: [{uid: 42}]}
              ]
            }]
          }
        }
      }
    }
  },

  mutate() {
    return {
      getUidsMap() {
        return {
          get() {}
        }
      }
    }
  }
}

describe('invoice.js', () => {
  describe('function create', () => {
    it('should assign an invoice number for corporate tickets', async () => {
      events.length = 0
      const tickets = [{participant: {uid: 42}, access_code: '5678'}]
      await invoice.create(txn, {type: 'corporate'}, {uid: 7}, tickets)
      events[0].type.should.equal('invoice-created')
      events[0].invoice.invoiceNo.should.equal(4711)
    })

    it('should not assign an invoice number when payed by PayPal', async () => {
      events.length = 0
      const tickets = [{participant: {uid: 42}, access_code: '5678'}]
      await invoice.create(txn, {type: 'private', payment: 'paypal'}, {uid: 7}, tickets)
      events[0].type.should.equal('invoice-created')
      events[0].invoice.invoiceNo.should.equal(0)
    })

    it('should report ticket ids to event store', async () => {
      events.length = 0
      const tickets = [
        {participant: {uid: 42}, access_code: '1234'},
        {participant: {uid: 42}, access_code: '5678'}
      ]
      await invoice.create(txn, {type: 'private'}, {uid: 7}, tickets)
      events[1].type.should.equal('ticket-created')
      events[1].ticket.id.should.equal(999)
      events[2].type.should.equal('ticket-created')
      events[2].ticket.id.should.equal(1000)
    })
  })
})
