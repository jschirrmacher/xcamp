module.exports = function ({models}) {
  const nodes = {}
  const ticketsByInvoiceId = {}
  const tickets = {}

  function removePersonFromNetwork(personId) {
    if (nodes[personId] && nodes[personId].links && nodes[personId].links.topics) {
      nodes[personId].links.topics.forEach(topicId => {
        if (nodes[topicId].links && nodes[topicId].links.persons) {
          nodes[topicId].links.persons = nodes[topicId].links.persons.filter(t => t !== personId)
        }
      })
    }
    delete nodes[personId]
  }

  const handlers = {
    handleTicketCreatedEvent(event, assert) {
      assert(event.ticket, `No ticket found in event`)
      assert(event.ticket.personId, `No person id found in event`)
      const person = models.network.getById(event.ticket.personId)
      assert(person, `Person in event not found`)
      nodes[event.ticket.personId] = {...person, type: 'person', shape: 'circle'}
      ticketsByInvoiceId[event.ticket.invoiceId] = ticketsByInvoiceId[event.ticket.invoiceId] || []
      ticketsByInvoiceId[event.ticket.invoiceId].push(event.ticket.personId)
      tickets[event.ticket.id] = event.ticket.personId
    },

    handleTopicLinkedEvent(event, assert) {
      assert(nodes[event.nodeId], 'Referenced node is unknown')
      assert(nodes[event.topicId], 'Referenced topic is unknown')
      nodes[event.nodeId].links = nodes[event.nodeId].links || {}
      nodes[event.nodeId].links.topics = nodes[event.nodeId].links.topics || []
      nodes[event.nodeId].links.topics.push(event.topicId)

      const type = nodes[event.nodeId].type + 's'
      nodes[event.topicId].links = nodes[event.topicId].links || {}
      nodes[event.topicId].links[type] = nodes[event.topicId].links[type] || []
      nodes[event.topicId].links[type].push(event.nodeId)
    },

    handleTopicUnlinkedEvent(event, assert) {
      assert(nodes[event.nodeId], 'Referenced node is unknown')
      assert(nodes[event.topicId], 'Referenced topic is unknown')
      const type = nodes[event.nodeId].type + 's'
      nodes[event.nodeId].links.topics = nodes[event.nodeId].links.topics.filter(t => t !== event.topicId)
      nodes[event.topicId].links[type] = nodes[event.topicId].links[type].filter(t => t !== event.nodeId)
    },

    handleParticipantSetEvent(event, assert) {
      assert(event.ticketId, 'ticketId not specified')
      assert(event.personId, 'personId not specified')
      assert(tickets[event.ticketId], 'Ticket not found')
      const person = models.network.getById(event.personId)
      assert(person, 'Person not found')
      removePersonFromNetwork(tickets[event.ticketId])
      nodes[event.personId] = {...person, type: 'person', shape: 'circle'}
      tickets[event.ticketId] = event.personId
    },

    handlePersonCreatedEvent(event, assert) {
      assert(event.person, 'No person found in event')
      assert(event.person.id, 'No person id found in event')
      assert(!nodes[event.person.id], 'Person already exists')
      event.person.details = '/network/persons/' + event.person.id
      nodes[event.person.id] = event.person
    },

    handleInvoiceDeletedEvent(event, assert) {
      assert(event.invoiceId, 'No invoiceId specified')
      assert(ticketsByInvoiceId[event.invoiceId], 'Invoice not found')
      ticketsByInvoiceId[event.invoiceId].forEach(removePersonFromNetwork)
      delete ticketsByInvoiceId[event.invoiceId]
    },

    handleRootCreatedEvent(event, assert) {
      assert(event.root, `No root found in event`)
      assert(event.root.id, `No root id found in event`)
      nodes[event.root.id] = {...event.root, type: 'root', open: true, shape: 'circle'}
    },

    handleTopicCreatedEvent(event, assert) {
      assert(event.topic, `No topic found in event`)
      assert(event.topic.id, `No topic id found in event`)
      nodes[event.topic.id] = {...event.topic, type: 'topic'}
    },

    handleRootUpdatedEvent(event, assert) {
      assert(nodes[event.root.id], `Referenced root is unknown`)
      nodes[event.root.id] = Object.assign(nodes[event.root.id], event.root)
    },

    handleTopicUpdatedEvent(event, assert) {
      assert(nodes[event.topic.id], `Referenced topic is unknown`)
      nodes[event.topic.id] = Object.assign(nodes[event.topic.id], event.topic)
    },

    handlePersonUpdatedEvent(event) {
      // Don't use 'assert' here because not all known persons are in the network
      if (nodes[event.person.id]) {
        nodes[event.person.id] = Object.assign(nodes[event.person.id], event.person)
      }
    }
  }

  function camelize(str) {
    return str.split('-').map(part => part[0].toUpperCase() + part.substr(1)).join('')
  }

  return {
    handleEvent(event, assert) {
      const method = 'handle' + camelize(event.type) + 'Event'
      if (handlers[method]) {
        handlers[method](event, assert)
      }
    },

    getAll() {
      return Object.values(nodes).filter(n => n.type !== 'topic' || (n.links.persons && n.links.persons.length) || (n.links.topics && n.links.topics.length))
    },

    getById(id) {
      return nodes[id]
    },

    canEdit(user, nodeId) {
      if (!user) {
        return false
      } else if (!nodeId || user.isAdmin) {
        return true
      } else {
        return nodeId === user.personId || user.ticketIds.indexOf(nodeId) !== -1
      }
    },

    getImageURL(person) {
      if (person && person.image) {
        if (person.image.match(/^\w+\/\w+:.*$/)) {
          return 'network/persons/' + person.id + '/picture/' + encodeURIComponent(person.image.replace(/.*:/, ''))
        } else {
          return person.image
        }
      }
      return 'user.png'
    }
  }
}
