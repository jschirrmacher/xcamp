/*eslint-env mocha*/
const should = require('should')

const storeListener = {}
const store = {
  on(event, handler) {
    storeListener[event.name] = handler
  },

  async emit(type, ...args) {
    const event = { ts: new Date(), type: type.name, ...type.construct(...args) }
    if (storeListener[event.type]) {
      storeListener[event.type](event)
    }
  }
}

const testPerson = {
  id: '0x4710',
  email: 'test@example.com',
  firstName: 'Tom',
}

const models = {}
models.user = require('./user')({ models, store })
const { userAdded } = require('../events')({ models })

const expectedUser = {
  id: '0x4710',
  email: 'test@example.com',
  firstName: 'Tom',
}

describe('readModels.user', () => {
  beforeEach(() => models.user.reset())

  it('should retrieve all users', () => {
    store.emit(userAdded, testPerson)
    models.user.getAll().should.deepEqual([expectedUser])
  })

  it('should retrieve a single user by id', () => {
    store.emit(userAdded, testPerson)
    models.user.getById('0x4710').should.deepEqual(expectedUser)
  })

  it('should throw if a user is not found by id', () => {
    store.emit(userAdded, testPerson)
    should(() => models.user.getById('0x666')).throw(`User '0x666' doesn't exist`)
  })

  it('should retrieve a single user by email', () => {
    store.emit(userAdded, testPerson)
    models.user.getByEMail('test@example.com').should.deepEqual(expectedUser)
  })

  it('should throw if a user is not found by email', () => {
    store.emit(userAdded, testPerson)
    should(() => models.user.getByEMail('unknown@example.com')).throw(`No user found with this e-mail address`)
  })
})
