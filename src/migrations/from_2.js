const stream = require('stream')
const topics = {}

module.exports = class From_2 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    switch (event.type) {
      case 'person-topic-linked':
        if (!topics[event.topic.id]) {
          delete event.topic.uid
          this.push({type: 'topic-created', ts: event.ts, topic: event.topic})
          topics[event.topic.id] = event.topic
        }
        this.push({type: event.type, ts:event.ts, personId: event.personId, topicId: event.topic.id})
        break

      case 'topic-created':
        if (!topics[event.topic.id || event.topic.uid]) {
          delete event.topic.uid
          this.push(event)
          topics[event.topic.id] = event.topic
        }
        break

      case 'topic-updated':
        event.topic.id = event.topic.id || event.topic.uid
        delete event.topic.uid
        if (!topics[event.topic.id]) {
          event.type = 'topic-created'
          topics[event.topic.id] = event.topic
        } else {
          topics[event.topic.id] = Object.assign(topics[event.topic.id], event.topic)
        }
        this.push(event)
        break

      default:
        this.push(event)
    }

    callback()
  }
}
