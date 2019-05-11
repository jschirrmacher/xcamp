const stream = require('stream')
const path = require('path')
const config = require(path.resolve(__dirname, '..', '..', 'config', 'migrationData_9.json'))

module.exports = class From_9 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    if (event.type === 'ticket-created' && !event.ticket.id) {
      event.ticket.id = config.ticketIds[event.ticket.access_code]
    }
    this.push(event)
    callback()
  }
}
