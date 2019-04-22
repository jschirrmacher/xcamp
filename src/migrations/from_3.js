const stream = require('stream')

module.exports = class From_3 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    const {ts, type, ...rest} = event
    this.push({ts, type, ...rest})
    callback()
  }
}
