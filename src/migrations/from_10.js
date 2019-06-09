const stream = require('stream')

const persons = {}
let storedEvent

module.exports = class From_10 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    function handleNewsletterApproval() {
      const person = event.customer.person[0]
      delete person.uid
      event.personId = person.id
      delete event.customer
      if (!persons[event.personId]) {
        if (storedEvent) {
          this.push({ts: storedEvent.ts, type: 'person-created', person})
          this.push(storedEvent)
          storedEvent = undefined
        } else {
          return true
        }
      }
      return false
    }

    switch (event.type) {
      case 'person-created':
        persons[event.person.id] = event.person
        break

      case 'person-updated':
        if (!persons[event.person.id]) {
          event.type = 'person-created'
        }
        persons[event.person.id] = event.person
        break

      case 'participant-set':
        if (!persons[event.personId]) {
          storedEvent = event
          callback()
          return
        }
        break

      case 'newsletter-approved':
        if (handleNewsletterApproval.call(this)) {
          callback()
          return
        }
        break
    }
    this.push(event)
    callback()
  }
}
