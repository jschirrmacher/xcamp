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

        const keys = Object.keys(event.person)
        if (keys.length === 1 && keys[0] === 'id') {
          callback()
          return
        }
        break

    }
    this.push(event)
    callback()
  }
}
