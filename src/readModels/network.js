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
          const person = models.network.getById(event.ticket.personId)
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

        case 'topic-linked': {
          assert(nodes[event.nodeId], 'Referenced node is unknown')
          assert(nodes[event.topicId], 'Referenced topic is unknown')
          nodes[event.nodeId].links = nodes[event.nodeId].links || {}
          nodes[event.nodeId].links.topics = nodes[event.nodeId].links.topics || []
          nodes[event.nodeId].links.topics.push(event.topicId)

          const type = nodes[event.nodeId].type + 's'
          nodes[event.topicId].links = nodes[event.topicId].links || {}
          nodes[event.topicId].links[type] = nodes[event.topicId].links[type] || []
          nodes[event.topicId].links[type].push(event.nodeId)
          break
        }

        case 'topic-unlinked': {
          assert(nodes[event.nodeId], 'Referenced node is unknown')
          assert(nodes[event.topicId], 'Referenced topic is unknown')
          const type = nodes[event.nodeId].type + 's'
          nodes[event.nodeId].links.topics = nodes[event.nodeId].links.topics.filter(t => t !== event.topicId)
          nodes[event.topicId].links[type] = nodes[event.topicId].links[type].filter(t => t !== event.nodeId)
          break
        }

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
          const person = models.network.getById(event.personId)
          assert(person, 'Person not found')
          removePersonFromNetwork(tickets[event.ticketId])
          nodes[event.personId] = {...person, type: 'person', shape: 'circle'}
          tickets[event.ticketId] = event.personId
          break
        }
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
      } else if (user.isAdmin) {
        return true
      } else {
        return nodeId === user.personId || user.ticketIds.indexOf(nodeId) !== false
      }
    }
  }
}
