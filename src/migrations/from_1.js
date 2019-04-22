const stream = require('stream')
const persons = {}

module.exports = class From_1 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    if (event.type === 'person-updated') {
      delete event.person.uid
      const topics = event.person.topics
      if (topics) {
        delete event.person.topics
        if (Object.keys(event.person).length > 1) {
          this.push(event)
        }
        const personId = event.person.id
        const existingTopics = persons[personId] || []
        topics.forEach(topic => {
          topic.id = topic.uid
          delete topic.uid
          if (!existingTopics.some(t => t.id === topic.id)) {
            this.push({type: 'person-topic-linked', ts: event.ts, personId, topic})
          }
        })
        existingTopics.forEach(topic => {
          if (!topics.some(t => t.id === topic.id)) {
            this.push({type: 'person-topic-unlinked', ts: event.ts, personId, topicId: topic.id})
          }
        })
        persons[personId] = topics
      } else {
        this.push(event)
      }
    } else {
      this.push(event)
    }

    callback()
  }
}
