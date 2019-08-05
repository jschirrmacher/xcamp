'use strict'

const select = require('./lib/select')

module.exports = (store, readModels) => {
  async function getGraph(user = null, eventName) {
    const nodes = readModels.network.getAll()
      .filter(node => ['person', 'topic', 'root'].includes(node.type))
      .map(node => getPublicViewOfNode({...node}, user))
      .map(node => {
        if (node.type === 'root' && node.name === eventName) {
          node.open = true
        }
        return node
      })
    return {nodes, myNode: user && user.personId}
  }

  function getPublicViewOfNode(node, user) {
    const fields = ['id', 'editable', 'details', 'name', 'image', 'type', 'links', 'description']
    if (readModels.network.canEdit(user, node.id)) {
      node.editable = true
    }
    if (node.type === 'person') {
      fields.push('topics')
      fields.push('talk')
      node.details = 'network/persons/' + node.id
      if (user || node.allowPublic) {
        fields.push('url')
        fields.push('twitterName')
        node.image = readModels.network.getImageURL(node)
        node.name = node.firstName + ' ' + node.lastName
      } else {
        node.image = 'user.png'
        node.name = 'Teilnehmer'
      }
      if (node.editable) {
        fields.push('talkReady')
        fields.push('access_code')
        fields.push('accountPath')
        fields.push('email')
        node.accountPath = user.ticketIds.length > 1 ? 'accounts/my' : 'accounts/my/invoices/current'
      }
      node = select(node, fields)
    }
    return node
  }

  return {
    getGraph,
    getPublicViewOfNode,
  }
}
