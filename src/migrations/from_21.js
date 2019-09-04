const stream = require('stream')

module.exports = class From_21 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    switch (event.type) {
      case 'person-created':
        event.person = {
          firstName: event.person.firstName,
          lastName: event.person.lastName,
          email: event.person.email,
          id: event.person.id,
          access_code: event.person.access_code
        }
        break

      case 'customer-created':
        event.customer = {
          firm: event.customer.firm,
          address: event.customer.address,
          postcode: event.customer.postcode,
          city: event.customer.city,
          country: event.customer.country,
          id: event.customer.id,
          access_code: event.customer.access_code,
          personId: event.customer.personId
        }
    }
    this.push(event)
    callback()
  }
}
