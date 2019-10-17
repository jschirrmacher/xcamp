const stream = require('stream')

const customerId2personId = {}

module.exports = class From_22 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    switch (event.type) {
      case 'customer-created':
        customerId2personId[event.customer.id] = event.customer.personId
        break

      case 'set-mail-hash':
      case 'password-changed':
        if (!customerId2personId[event.userId] || event.hash && !event.hash.match) {
          callback()
          return
        }
        event.userId = customerId2personId[event.userId]
        break

    }
    this.push(event)
    callback()
  }
}
