const stream = require('stream')
const diff = require('../lib/diff')
const objects = {}

module.exports = class From_0 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    function handleTopicChanges(event) {
      const type = event.type.replace('-updated', '')
      const changed = event[type]
      const object = objects[changed.id]
      if (object) {
        const delta = diff(object, changed)
        objects[changed.id] = {...object, ...delta}
        return {type: event.type, ts: event.ts, [type]: {id: changed.id, ...delta}}
      } else {
        objects[changed.id] = changed
        return event
      }
    }

    switch (event.type) {
      case 'person-updated':
      case 'root-updated':
      case 'topic-updated':
        this.push(handleTopicChanges(event))
        break

      default:
        this.push(event)
    }

    callback()
  }
}
