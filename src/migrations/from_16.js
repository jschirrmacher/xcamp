const stream = require('stream')

const mapping = require('../../config/migrationData_16.json')

module.exports = class From_16 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    if (event.type === 'ticket-created') {
      if (!event.ticket.id && !mapping[event.ticket.access_code]) {
        throw 'No mapping found for event ' + event.ts + ': ' + event.ticket.access_code
      }
      if (event.ticket.id && mapping[event.ticket.access_code] !== event.ticket.id) {
        throw 'Ticket id mismatch in event ' + event.ts + ': ' + mapping[event.ticket.access_code]
      }
      event.ticket.id = mapping[event.ticket.access_code]
    }

    this.push(event)
    callback()
  }
}
