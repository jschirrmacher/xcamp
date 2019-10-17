/*eslint-env mocha*/
const should = require('should')

const testPerson = {
  id: '0x4710',
  email: 'test@example.com',
  firstName: 'Tom',
  access_code: 'person-access-code'
}
const testCustomer = {id: '0x4711', personId: '0x4710'}
const testInvoice = {id: '0x4712', customerId: '0x4711', ticketType: 'normal'}
const testTicket1 = {personId: '0x4710', invoiceId: '0x4712', access_code: 'ticket-access-code-1'}
const testTicket2 = {personId: '0x4710', invoiceId: '0x4712', access_code: 'ticket-access-code-2'}

const models = {}
models.person = require('./person')()
models.network = {
  getById(id) {
    if (id === '0x4710') {
      return testPerson
    }
    throw 'Not found'
  }
}
models.user = require('./user')({models})

const assert = () => {}

const expectedUser = {
  id: '0x4710',
  personId: '0x4710',
  access_code: 'person-access-code',
  email: 'test@example.com',
  firstName: 'Tom',
  image: 'user.png',
  password: null,
  hash: null,
  isAdmin: null
}

function createCustomer() {
  const personCreatedEvent = {type: 'person-created', person: testPerson}
  models.person.handleEvent(personCreatedEvent, assert)
  models.user.handleEvent(personCreatedEvent, assert)
  models.user.handleEvent({type: 'customer-created', customer: testCustomer}, assert)
}

describe('readModels.user', () => {
  beforeEach(() => models.user.reset())

  it('should retrieve all users', () => {
    createCustomer()
    models.user.getAll().should.deepEqual([expectedUser])
  })

  it('should retrieve a single user by id', () => {
    createCustomer()
    models.user.getById('0x4710').should.deepEqual(expectedUser)
  })

  it('should throw if a user is not found by id', () => {
    createCustomer()
    should(() => models.user.getById('0x666')).throw(`User '0x666' doesn't exist`)
  })

  it('should retrieve a single user by access code', () => {
    createCustomer()
    models.user.getByAccessCode('person-access-code').should.deepEqual(expectedUser)
  })

  it('should throw if a user is not found by access code', () => {
    createCustomer()
    should(() => models.user.getByAccessCode('unknown-access-code')).throw(`No user found with this access code`)
  })

  it('should retrieve a single user by email', () => {
    createCustomer()
    models.user.getByEMail('test@example.com').should.deepEqual(expectedUser)
  })

  it('should throw if a user is not found by email', () => {
    createCustomer()
    should(() => models.user.getByEMail('unknown@example.com')).throw(`No user found with this e-mail address`)
  })

  it('should add a person\'s image', () => {
    createCustomer()
    models.person.handleEvent({type: 'person-updated', person: {id: '0x4710', image: 'image.jpg'}}, assert)
    const expectedUsers = [Object.assign({}, expectedUser, {image: 'image.jpg'})]
    models.user.getAll().should.deepEqual(expectedUsers)
  })

  it('should recognize password changes regardless of accessor', () => {
    createCustomer()
    models.user.handleEvent({type: 'password-changed', userId: '0x4710', passwordHash: 'hashed-password'}, assert)
    models.user.getById('0x4710').password.should.equal('hashed-password')
    models.user.getByAccessCode('person-access-code').password.should.equal('hashed-password')
    models.user.getByEMail('test@example.com').password.should.equal('hashed-password')
  })

  it('should recognize hash changes regardless of accessor', () => {
    createCustomer()
    models.user.handleEvent({type: 'set-mail-hash', userId: '0x4710', hash: 'new-hash'}, assert)
    models.user.getById('0x4710').hash.should.equal('new-hash')
    models.user.getByAccessCode('person-access-code').hash.should.equal('new-hash')
    models.user.getByEMail('test@example.com').hash.should.equal('new-hash')
  })
})
