const select = require('../lib/select')

module.exports = function ({models, config}) {
  const nodes = {}
  const ticketsByInvoiceId = {}
  const tickets = {}
  let maxNodeId = 0
  const rcChannels = {}
  const rcUsers = {}
  const rcMembers = {}

  function makeNodeFromPerson(person) {
    nodes[person.id] = {
      ...person,
      type: 'person',
      links: (nodes[person.id] && nodes[person.id].links) || {}
    }
  }

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

  async function getFromRC(path) {
    const headers = {
      'X-Auth-Token': config.chat.bot.token,
      'X-User-Id': config.chat.bot.userId
    }
    const response = await fetch('https://chat.xcamp.co/api' + path, { headers })
    const content = response.headers.get('content-type').match(/json/) ? await response.json() : await response.text()
    if (!response.ok) {
      return {success: false, message: response.status + ' ' + response.statusText, content}
    }
    return content
  }

  const handlers = {
    handleTicketCreatedEvent(event, assert) {
      assert(event.ticket, `No ticket found in event`)
      assert(event.ticket.personId, `No person id found in event`)
      const person = models.person.getById(event.ticket.personId)
      assert(person, `Person in event not found`)
      makeNodeFromPerson(person)
      ticketsByInvoiceId[event.ticket.invoiceId] = ticketsByInvoiceId[event.ticket.invoiceId] || []
      ticketsByInvoiceId[event.ticket.invoiceId].push(event.ticket.personId)
      tickets[event.ticket.id] = event.ticket.personId
    },

    handleTopicLinkedEvent(event, assert) {
      assert(nodes[event.nodeId], 'Referenced node is unknown')
      assert(nodes[event.topicId], 'Referenced topic is unknown')
      const type = nodes[event.nodeId].type + 's'

      nodes[event.nodeId].links = nodes[event.nodeId].links || {}
      nodes[event.nodeId].links.topics = nodes[event.nodeId].links.topics || []
      assert(!nodes[event.nodeId].links.topics.find(t => t.id === event.topicId))
      nodes[event.nodeId].links.topics.push(event.topicId)

      nodes[event.topicId].links = nodes[event.topicId].links || {}
      nodes[event.topicId].links[type] = nodes[event.topicId].links[type] || []
      assert(!nodes[event.topicId].links[type].find(n => n.id === event.nodeId))
      nodes[event.topicId].links[type].push(event.nodeId)
    },

    handleTopicUnlinkedEvent(event, assert) {
      assert(nodes[event.nodeId], 'Referenced node is unknown')
      const type = nodes[event.nodeId].type + 's'
      nodes[event.nodeId].links.topics = nodes[event.nodeId].links.topics.filter(t => t !== event.topicId)
      nodes[event.topicId].links[type] = nodes[event.topicId].links[type].filter(t => t !== event.nodeId)
    },

    handleParticipantSetEvent(event, assert) {
      assert(event.ticketId, 'ticketId not specified')
      assert(event.personId, 'personId not specified')
      assert(tickets[event.ticketId], 'Ticket not found')
      const person = models.person.getById(event.personId)
      assert(person, 'Person not found')
      removePersonFromNetwork(tickets[event.ticketId])
      makeNodeFromPerson(person)
      tickets[event.ticketId] = event.personId
    },

    handleInvoiceDeletedEvent(event, assert) {
      assert(event.invoiceId, 'No invoiceId specified')
      assert(ticketsByInvoiceId[event.invoiceId], 'Invoice not found')
      ticketsByInvoiceId[event.invoiceId].forEach(removePersonFromNetwork)
      delete ticketsByInvoiceId[event.invoiceId]
    },

    handleNodeCreatedEvent(event, assert) {
      assert(event.node, `No node found in event`)
      assert(event.node.id, `No node id found in event`)
      nodes[event.node.id] = {...event.node}
      maxNodeId = Math.max(event.node.id, maxNodeId)
    },

    handleNodeUpdatedEvent(event, assert) {
      assert(nodes[event.node.id], `Referenced node is unknown`)
      nodes[event.node.id] = Object.assign(nodes[event.node.id], event.node)
    },

    handlePersonUpdatedEvent(event) {
      if (nodes[event.person.id]) {
        makeNodeFromPerson(models.person.getById(event.person.id))
      }
    }
  }

  function camelize(str) {
    return str.split('-').map(part => part[0].toUpperCase() + part.substr(1)).join('')
  }

  return {
    dependencies: ['person'],

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

    async getGraph(user = null, eventName) {
      const nodes = []

      function addNode(id, type, name, image, channel, details = undefined, links = {}) {
        nodes.push({id, type, name, image, channel, shape: 'circle', open: true, details, links})
      }

      try {
        const users = await getFromRC('/v1/users.list')
        users.users.forEach(user => {
          if (user.active && user.roles.includes('user')) {
            addNode(user._id, 'person', user.name, 'https://chat.xcamp.co/avatar/' + user.username, '/direct/' + user.username, undefined, {topics: []})
          }
        })
        const channels = await getFromRC('/v1/channels.list')
        await Promise.all(channels.channels.map(async channel => {
          const members = await getFromRC('/v1/channels.members?roomId=' + channel._id)
          const persons = members.members.map(member => member._id)
          persons.forEach(personId => {
            nodes.some(node => node.id === personId && node.links.topics.push(channel._id))
          })
          addNode(channel._id, 'topic', channel.topic || channel.name, null, '/channel/' + channel.name, channel.description, {persons})
        }))
        return {nodes, myNode: user && user.personId}
      } catch (error) {
        console.log(error)
        return {error}
      }
    },

    getPublicViewOfNode(node, user) {
      const fields = ['id', 'editable', 'details', 'name', 'image', 'type', 'links', 'description']
      node.shape = 'circle'
      if (models.network.canEdit(user, node.id)) {
        node.editable = true
      }
      if (node.type === 'person') {
        fields.push('topics')
        fields.push('talk')
        node.details = 'network/persons/' + node.id
        if (user || node.allowPublic) {
          fields.push('url')
          fields.push('twitterName')
          node.image = models.network.getImageURL(node)
          node.name = node.firstName + ' ' + node.lastName
        } else {
          node.image = 'assets/img/user.png'
          node.name = 'Teilnehmer'
        }
        if (node.editable) {
          fields.push('talkReady')
          fields.push('allowPublic')
          fields.push('access_code')
          fields.push('accountPath')
          fields.push('email')
          node.accountPath = 'accounts/my'
        }
        node = select(node, fields)
      }
      return node
    },

    canEdit(user, nodeId) {
      if (!user) {
        return false
      } else if (!nodeId || user.isAdmin) {
        return true
      } else {
        return nodeId === user.id
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
      return 'assets/img/user.png'
    },

    getMaxId() {
      return maxNodeId
    }
  }
}
