module.exports = function(add) {
  const topics = {}

  return function (event) {
    switch (event.type) {
      case 'person-topic-linked':
        if (!topics[event.topic.id]) {
          delete event.topic.uid
          add({type: 'topic-created', ts: event.ts, topic: event.topic})
          topics[event.topic.id] = event.topic
        }
        add({type: event.type, ts:event.ts, personId: event.personId, topicId: event.topic.id})
        break

      case 'topic-created':
        if (!topics[event.topic.id || event.topic.uid]) {
          delete event.topic.uid
          add(event)
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
        add(event)
        break

      default:
        add(event)
    }
  }
}
