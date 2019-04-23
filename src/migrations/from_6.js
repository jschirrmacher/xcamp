const stream = require('stream')

module.exports = class From_6 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    this.push(event)
    if (event.type === 'topic-created' && ['0x186ae', '0x186af', '0x186b0', '0x186b1'].includes(event.topic.id)) {
      this.push({ts: event.ts, type: 'topic-root-linked', topicId: event.topic.id, rootId: '0x186b2'})
    }
    callback()
  }
}
