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

const expectedCustomerUser = {
  id: 4711,
  personId: 4710,
  type: 'customer',
  access_code: 'customer-access-code',
  email: 'test@example.com',
  firstName: 'Tom',
  image: 'user.png',
  ticketIds: []
}

function createCustomer() {
  models.user.handleEvent({type: 'person-created', person: testPerson}, assert)
  models.user.handleEvent({type: 'customer-created', customer: testCustomer}, assert)
}

describe('readModels.user', () => {
  it('should retrieve all users', () => {
    createCustomer()
    models.user.getAll().should.deepEqual([expectedCustomerUser])
  })

  it('should retrieve a single user by id', () => {
    createCustomer()
    models.user.getById(4711).should.deepEqual(expectedCustomerUser)
  })

  it('should throw if a user is not found by id', () => {
    createCustomer()
    should(() => models.user.getById(666)).throw(`User '666' doesn't exist`)
  })

  it('should retrieve a single user by access code', () => {
    createCustomer()
    models.user.getByAccessCode('customer-access-code').should.deepEqual(expectedCustomerUser)
  })

  it('should throw if a user is not found by access code', () => {
    createCustomer()
    should(() => models.user.getByAccessCode('unknown-access-code')).throw(`No user found with this access code`)
  })

  it('should retrieve a single user by email', () => {
    createCustomer()
    models.user.getByEMail('test@example.com').should.deepEqual(expectedCustomerUser)
  })

  it('should throw if a user is not found by email', () => {
    createCustomer()
    should(() => models.user.getByEMail('unknown@example.com')).throw(`No user found with this e-mail address`)
  })

  it('should add a person\'s image', () => {
    createCustomer()
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
    createCustomer()
    models.user.handleEvent({type: 'invoice-created', invoice: testInvoice}, assert)
    models.user.handleEvent({type: 'ticket-created', ticket: testTicket1}, assert)
    models.user.handleEvent({type: 'ticket-created', ticket: testTicket2}, assert)
    models.user.handleEvent({type: 'invoice-deleted', invoiceId: 4712})
    models.user.getAll().should.deepEqual([])
  })
})
