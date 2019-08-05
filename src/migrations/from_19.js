const stream = require('stream')

let nodeId = 0
const mapping = {}

function setNextId(object, attribute) {
  mapping[object[attribute]] = ++nodeId
  object[attribute] = nodeId
}

function replaceId(object, attribute) {
  if (mapping[object[attribute]]) {
    object[attribute] = mapping[object[attribute]]
  }
}

module.exports = class From_19 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    const type = event.type.replace(/-(created|updated)/, '')

    switch (event.type) {
      case 'root-created':
      case 'topic-created':
        event.type = 'node-created'
        event.node = event[type]
        setNextId(event.node, 'id')
        event.node.type = type
        delete event[type]
        delete event.node.uid
        break

      case 'root-updated':
      case 'topic-updated':
        event.type = 'node-updated'
        event.node = event[type]
        replaceId(event.node, 'id')
        delete event[type]
        delete event.node.uid
        break

      case 'topic-linked':
      case 'topic-unlinked':
        replaceId(event, 'topicId')
        replaceId(event, 'nodeId')
        break

    }
    this.push(event)
    callback()
  }
}
