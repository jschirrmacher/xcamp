require('should')

const testPerson = {
  id: 4710,
  email: 'test@example.com',
  firstName: 'Tom'
}
const testCustomer = {id: 4711, personId: 4710, access_code: 'customer-access-code'}
const testInvoice = {id: 4712, customerId: 4711, ticketType: 'normal'}
const testTicket1 = {personId: 4710, invoiceId: 4712, access_code: 'ticket-access-code-1'}
const testTicket2 = {personId: 4710, invoiceId: 4712, access_code: 'ticket-access-code-2'}

const models = {
  network: {
    getById(id) {
      if (id === 4710) {
        return testPerson
      }
      throw 'Not found'
    }
  }
}
models.user = require('./user')({models})

const assert = () => {}

describe('readModels.user', () => {
  it('should add customers as users', () => {
    models.user.handleEvent({type: 'person-created', person: testPerson}, assert)
    models.user.handleEvent({type: 'customer-created', customer: testCustomer}, assert)
    models.user.getAll().should.deepEqual([{
      id: 4711,
      personId: 4710,
      type: 'customer',
      access_code: 'customer-access-code',
      email: 'test@example.com',
      firstName: 'Tom',
      image: 'user.png',
      ticketIds: []
    }])
  })

  it('should add a person\'s image', () => {
    models.user.handleEvent({type: 'person-created', person: testPerson}, assert)
    models.user.handleEvent({type: 'customer-created', customer: testCustomer}, assert)
    models.user.handleEvent({type: 'person-updated', person: {id: 4710, image: 'image.jpg'}}, assert)
    models.user.getAll().should.deepEqual([{
      id: 4711,
      personId: 4710,
      type: 'customer',
      access_code: 'customer-access-code',
      email: 'test@example.com',
      firstName: 'Tom',
      image: 'image.jpg',
      ticketIds: []
    }])
  })

  it('should delete users when the invoice is deleted', () => {
    models.user.handleEvent({type: 'person-created', person: testPerson}, assert)
    models.user.handleEvent({type: 'customer-created', customer: testCustomer}, assert)
    models.user.handleEvent({type: 'invoice-created', invoice: testInvoice}, assert)
    models.user.handleEvent({type: 'ticket-created', ticket: testTicket1}, assert)
    models.user.handleEvent({type: 'ticket-created', ticket: testTicket2}, assert)
    models.user.handleEvent({type: 'invoice-deleted', invoiceId: 4712})
    models.user.getAll().should.deepEqual([])
  })
})
