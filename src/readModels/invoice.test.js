require('should')

const config = {ticketCategories: {corporate: 300}}
const models = {}
models.person = require('./person')()
models.invoice = require('./invoice')({models, config})

const testPerson1 = {id: 4710, email: 'test1@example.com', firstName: 'Tom'}
const testCustomer1 = {id: 4711, personId: 4710}

const testPerson2 = {id: 4712, email: 'test2@example.com', firstName: 'Tim'}
const testCustomer2 = {id: 4713, personId: 4712}

const invoice1 = {id: 1, invoiceNo: 100, customerId: testCustomer1.id}
const invoice2 = {id: 2, invoiceNo: 101, customerId: testCustomer2.id}
const invoice3 = {id: 3, invoiceNo: 102, customerId: testCustomer1.id}

const assert = () => {}

models.invoice.handleEvent({type: 'person-created', person: testPerson1}, assert)
models.invoice.handleEvent({type: 'customer-created', customer: testCustomer1}, assert)
models.invoice.handleEvent({type: 'invoice-created', invoice: invoice1}, assert)

models.invoice.handleEvent({type: 'person-created', person: testPerson2}, assert)
models.invoice.handleEvent({type: 'customer-created', customer: testCustomer2}, assert)
models.invoice.handleEvent({type: 'invoice-created', invoice: invoice2}, assert)

models.invoice.handleEvent({type: 'invoice-created', invoice: invoice3}, assert)

describe('readModels.invoice', () => {
  describe('getByCustomerId', () => {
    it('should return a list of invoices for the given customer', () => {
      const list = models.invoice.getByCustomerId(4711)
      list.should.be.an.Array()
      list.map(e => e.customer.id).should.deepEqual([testCustomer1.id, testCustomer1.id])
    })

    it('should return sorted invoices', () => {
      const list = models.invoice.getByCustomerId(4711)
      list.map(e => e.invoiceNo).should.deepEqual([invoice3.invoiceNo, invoice1.invoiceNo])
    })
  })
})
