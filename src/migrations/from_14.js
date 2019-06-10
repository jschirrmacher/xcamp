const stream = require('stream')

module.exports = class From_13 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    if (event.type === 'applied-to-reduced') {
      event.person = event.data
      delete event.data
    }
    this.push(event)
    callback()
  }
}
