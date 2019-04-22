module.exports = function(add) {
  const persons = {}

  return function (event) {
    if (event.type === 'person-updated') {
      delete event.person.uid
      const topics = event.person.topics
      if (topics) {
        delete event.person.topics
        if (Object.keys(event.person).length > 1) {
          add(event)
        }
        const personId = event.person.id
        const existingTopics = persons[personId] || []
        topics.forEach(topic => {
          topic.id = topic.uid
          delete topic.uid
          if (!existingTopics.some(t => t.id === topic.id)) {
            add({type: 'person-topic-linked', ts: event.ts, personId, topic})
          }
        })
        existingTopics.forEach(topic => {
          if (!topics.some(t => t.id === topic.id)) {
            add({type: 'person-topic-unlinked', ts: event.ts, personId, topicId: topic.id})
          }
        })
        persons[personId] = topics
      } else {
        add(event)
      }
    } else {
      add(event)
    }
  }
}
