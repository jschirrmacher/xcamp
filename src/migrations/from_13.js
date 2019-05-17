const stream = require('stream')

const topics = {}
const aliases = {}

module.exports = class From_13 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    switch (event.type) {
      case 'topic-created':
        const name = event.topic.name.toLowerCase()
        if (topics[name]) {
          aliases[event.topic.id] = topics[name]
          callback()
          return
        } else {
          topics[name] = event.topic.id
        }
        break

      case 'topic-updated':
        if (aliases[event.topic.id]) {
          return
        }
        break

      default:
        let str = JSON.stringify(event)
        Object.keys(aliases).forEach(alias => str = str.split('"' + alias + '"').join('"' + aliases[alias] + '"'))
        event = JSON.parse(str)

    }
    this.push(event)
    callback()
  }
}
