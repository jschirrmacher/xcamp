/*eslint-env mocha*/
require('should')

const select = require('./select')

describe('select() function', () => {
  it('should select only the specified fields from an object', () => {
    select({a: 1, b: 2}, ['b']).should.deepEqual({b: 2})
  })

  it('should select multiple fields', () => {
    select({a: 1, b: 2, c: 3}, ['a', 'c']).should.deepEqual({a: 1, c: 3})
  })

  it('should keep the original object unchanged', () => {
    const obj = {a: 1, b: 2, c: 3}
    select(obj, ['b'])
    obj.should.deepEqual({a: 1, b: 2, c: 3})
  })
})
