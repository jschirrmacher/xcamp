const stream = require('stream')

module.exports = class From_12 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    switch (event.type) {
      case 'topic-root-linked':
        event.type = 'topic-linked'
        event.nodeId = event.rootId
        delete event.rootId
        break

      case 'person-topic-linked':
        event.type = 'topic-linked'
        event.nodeId = event.personId
        delete event.personId
        break

      case 'person-topic-unlinked':
        event.type = 'topic-unlinked'
        event.nodeId = event.personId
        delete event.personId
        break

    }
    this.push(event)
    callback()
  }
}
