const stream = require('stream')

module.exports = class From_10 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    switch (event.type) {
      case 'person-created':
      case 'person-updated':
        if (event.person.image === 'user.png') {
          delete event.person.image
        } else if (event.person.image) {
          event.person.image = event.person.image.replace(/^.*\/(.*\.(\w+))$/, 'image/$2:$1')
        }

        if (Object.keys(event.person).join(',') !== 'id') {
          this.push(event)
        }
        break

      default:
        this.push(event)
    }
    callback()
  }
}
