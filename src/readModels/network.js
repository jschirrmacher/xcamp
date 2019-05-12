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

  return {
    handleEvent(event, assert) {
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

        case 'ticket-created': {
          assert(event.ticket, `No ticket found in event`)
          assert(event.ticket.personId, `No person id found in event`)
          const person = models.person.getById(event.ticket.personId)
          assert(person, `Person in event not found`)
          nodes[event.ticket.personId] = {...person, type: 'person', shape: 'circle'}
          ticketsByInvoiceId[event.ticket.invoiceId] = ticketsByInvoiceId[event.ticket.invoiceId] || []
          ticketsByInvoiceId[event.ticket.invoiceId].push(event.ticket.personId)
          tickets[event.ticket.id] = event.ticket.personId
          break
        }

        case 'person-created':
          assert(event.person, 'No person found in event')
          assert(event.person.id, 'No person id found in event')
          assert(!nodes[event.person.id], 'Person already exists')
          event.person.details = '/network/persons/' + event.person.id
          nodes[event.person.id] = event.person
          break

        case 'root-updated':
        case 'topic-updated': {
          const type = event.type.replace('-updated', '')
          assert(nodes[event[type].id], `Referenced ${type} is unknown`)
          nodes[event[type].id] = Object.assign(nodes[event[type].id], event[type])
          break
        }

        case 'person-updated':
          // Don't use 'assert' here because not all known persons are in the network
          if (nodes[event.person.id]) {
            nodes[event.person.id] = Object.assign(nodes[event.person.id], event.person)
          }
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

        case 'invoice-deleted':
          assert(event.invoiceId, 'No invoiceId specified')
          assert(ticketsByInvoiceId[event.invoiceId], 'Invoice not found')
          ticketsByInvoiceId[event.invoiceId].forEach(removePersonFromNetwork)
          delete ticketsByInvoiceId[event.invoiceId]
          break

        case 'participant-set': {
          assert(event.ticketId, 'ticketId not specified')
          assert(event.personId, 'personId not specified')
          assert(tickets[event.ticketId], 'Ticket not found')
          const person = models.person.getById(event.personId)
          assert(person, 'Person not found')
          removePersonFromNetwork(tickets[event.ticketId])
          nodes[event.personId] = {...person, type: 'person', shape: 'circle'}
          tickets[event.ticketId] = event.personId
          break
        }
      }
    },

    getAll() {
      return Object.values(nodes).filter(n => n.type !== 'topic' || n.links.persons.length)
    },

    getById(id) {
      return nodes[id]
    }
  }
}
