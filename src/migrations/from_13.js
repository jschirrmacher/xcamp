const stream = require('stream')

const topics = {}
const aliases = {}

module.exports = class From_13 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    if (event.type === 'topic-created') {
      const name = event.topic.name.toLowerCase()
      if (topics[name]) {
        aliases[event.topic.id] = topics[name]
        callback()
        return
      } else {
        topics[name] = event.topic.id
      }
    } else if (event.type === 'topic-updated') {
      if (aliases[event.topic.id]) {
        return
      }
    } else {
      let str = JSON.stringify(event)
      Object.keys(aliases).forEach(alias => str = str.split('"' + alias + '"').join('"' + aliases[alias] + '"'))
      event = JSON.parse(str)
    }
    this.push(event)
    callback()
  }
}
