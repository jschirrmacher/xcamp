const stream = require('stream')
const topics = {}

module.exports = class From_4 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    switch (event.type) {
      case 'root-added':
        event.type = 'root-created'
        event.root = event.node
        delete event.node
        this.push(event)
        break

      case 'topic-added':
        event.type = 'topic-created'
        event.topic = event.node
        delete event.node
        topics[event.topic.id] = event.topic
        this.push(event)
        break

      case 'topic-created':
      case 'topic-updated':
        if (topics[event.topic.id]) {
          event.type = 'topic-updated'
          topics[event.topic.id] = {...topics[event.topic.id], ...event.topic}
          this.push(event)
        } else {
          event.type = 'topic-created'
          topics[event.topic.id] = event.topic
          this.push(event)
        }
        break

      default:
        this.push(event)
    }
    callback()
  }
}
