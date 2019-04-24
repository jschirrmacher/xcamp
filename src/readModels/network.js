module.exports = function ({logger, models}) {
  const nodes = {}

  return {
    handleEvent(event) {
      function assert(condition, message) {
        if (!condition) {
          throw `Read model '${__filename}, event '${event.type}' (${event.ts}): ${message}`
        }
      }

      try {
        switch (event.type) {
          case 'root-created':
            assert(event.root, `No root found in event`)
            assert(event.root.id, `No root id found in event`)
            nodes[event.root.id] = {...event.root, type: 'root', open: true, shape: 'circle'}
            break

          case 'topic-created': {
            assert(event.topic, `No topic found in event`)
            assert(event.topic.id, `No topic id found in event`)
            nodes[event.topic.id] = {...event.topic, type: 'topic'}
            break
          }

          case 'ticket-created':
            assert(event.ticket, `No ticket found in event`)
            assert(event.ticket.personId, `No person id found in event`)
            const person = models.person.getById(event.ticket.personId)
            assert(person, `Person in event not found`)
            nodes[event.ticket.personId] = {...person, type: 'person', shape: 'circle'}
            break

          case 'root-updated':
          case 'topic-updated': {
            const type = event.type.replace('-updated', '')
            assert(nodes[event[type].id], `Referenced ${type} is unknown`)
            nodes[event[type].id] = Object.assign(nodes[event[type].id], event[type])
            break
          }

          case 'person-updated':
            assert(nodes[event.person.id], 'Referenced person is unknown')
            nodes[event.person.id] = Object.assign(nodes[event.person.id], event.person)
            break

          case 'person-topic-linked':
            assert(nodes[event.personId], 'Referenced person is unknown')
            assert(nodes[event.topicId], 'Referenced topic is unknown')
            nodes[event.personId].links = nodes[event.personId].links || {}
            nodes[event.personId].links.topics = nodes[event.personId].links.topics || []
            nodes[event.personId].links.topics.push(event.topicId)

            nodes[event.topicId].links = nodes[event.topicId].links || {}
            nodes[event.topicId].links.persons = nodes[event.topicId].links.persons || []
            nodes[event.topicId].links.persons.push(event.personId)
            break

          case 'person-topic-unlinked':
            assert(nodes[event.personId], 'Referenced person is unknown')
            assert(nodes[event.topicId], 'Referenced topic is unknown')
            nodes[event.personId].links.topics = nodes[event.personId].links.topics.filter(t => t !== event.topicId)
            nodes[event.topicId].links.persons = nodes[event.topicId].links.persons.filter(t => t !== event.personId)
            break

          case 'topic-root-linked':
            assert(nodes[event.rootId], 'Referenced root is unknown')
            assert(nodes[event.topicId], 'Referenced topic is unknown')
            nodes[event.rootId].links = nodes[event.rootId].links || {}
            nodes[event.rootId].links.topics = nodes[event.rootId].links.topics || []
            nodes[event.rootId].links.topics.push(event.topicId)

            nodes[event.topicId].links = nodes[event.topicId].links || {}
            nodes[event.topicId].links.persons = nodes[event.topicId].links.persons || []
            nodes[event.topicId].links.persons.push(event.rootId)
            break

        }
      } catch (error) {
        logger.error(error)
      }
    },

    getAll() {
      return Object.values(nodes)
    },

    getByUserId(id) {
      return nodes[id]
    }
  }
}
