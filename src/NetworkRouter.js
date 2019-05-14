const path = require('path')
const multer = require('multer')
const upload = multer({dest: path.resolve(__dirname , '..', 'profile-pictures')})

module.exports = (dependencies) => {
  const {
    express,
    auth,
    makeHandler,
    templateGenerator,
    Model,
    store,
    readModels
  } = dependencies

  function getSessionList() {
    const sessions = readModels.session.getAll().map(session => {
      const person = readModels.network.getById(session.person.id)
      session.image = Model.Network.getImageURL(person.id, person.image)
      session.talk = session.talk.length < 140 ? session.talk : session.talk.substring(0, 139) + '…'
      return session
    })
    return templateGenerator.generate('session-list', {sessions})
  }

  function getPersonDetails(id, user) {
    const node = {...readModels.network.getById(id)}
    node.topics = node.links && node.links.topics && node.links.topics.map(id => {
      const linkedNode = readModels.network.getById(id)
      return {id, name: linkedNode.name}
    })
    return Model.Network.getPublicViewOfNode(node, user)
  }

  async function uploadProfilePicture(txn, id, file, user) {
    const result = await Model.Person.uploadProfilePicture(txn, id, file, user)
    result.node = Model.Network.getPublicViewOfNode(result.node, user)
    return result
  }

  async function updatePerson(txn, id, body, user) {
    const result = await Model.Person.updateById(txn, id, body, user)
    result.node = Model.Network.getPublicViewOfNode(result.node, user)
    return result
  }

  function canEdit(user, uid) {
    if (!user) {
      return false
    } else if (user.isAdmin) {
      return true
    } else if (user.type === 'customer') {
      return !uid || user.invoices[0].tickets.some(ticket => ticket.participant[0].uid === uid)
    } else if (user.type === 'ticket') {
      return uid === user.participant[0].uid
    } else {
      return uid === user.uid
    }
  }

  async function assignTopic(txn, node, topicName, user) {
    if (!canEdit(user, node.id)) {
      throw 'Changing this node is not allowed!'
    }
    const links2create = []
    const links2delete = []
    const nodes2create = []
    node.link = node.links || {}
    node.link.topics = node.links.topics || []
    const name = topicName.trim()
    const topic = readModels.topic.getByName(name) || await createTopic(name)
    if (!node.links.topics.includes(topic.id)) {
      // node.links.topics.push(topic)
      links2create.push({source: {id: node.id}, target: {id: topic.id, ...topic}})
      store.add({type: 'topic-linked', nodeId: node.id, topicId: topic.id})
    }
    return {links2create, links2delete, nodes2create, node}

    async function createTopic(name) {
      const result = await Model.Topic.upsert(txn, {}, {name}, user)
      nodes2create.push(result.node)
      return result.node
    }
  }

  async function removeTopic(txn, node, topicName, user) {
    if (!canEdit(user, node.id)) {
      throw 'Changing this node is not allowed!'
    }
    const links2delete = []
    const topic = readModels.topic.getByName(topicName)
    node.links.topics = node.links.topics || []
    if (node.links.topics.includes(topic.id)) {
      links2delete.push({source: {id: node.id}, target: {id: topic.id}})
      node.links.topics = node.links.topics.filter(t => t !== topic.id)
      store.add({type: 'topic-unlinked', nodeId: node.id, topicId: topic.id})
    }
    return {links2delete, node}
  }

  const router = express.Router()
  const allowAnonymous = true

  router.get('/', auth.requireJWT({allowAnonymous}), makeHandler(req => Model.Network.getGraph(req.user)))
  router.delete('/', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => Model.Network.rebuild()))

  router.put('/roots/:uid', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => Model.Root.updateById(req.txn, req.params.uid, req.body, req.user), {commit: true}))

  router.get('/topics', makeHandler(req => Model.Topic.find(req.txn, req.query.q), {txn: true}))
  router.put('/topics/:uid', auth.requireJWT(), makeHandler(req => Model.Topic.updateById(req.txn, req.params.uid, req.body, req.user), {commit: true}))

  router.post('/persons', auth.requireJWT(), makeHandler(req => Model.Person.upsert(req.txn, {}, req.body, req.user), {commit: true}))
  router.get('/persons/:uid', auth.requireJWT({allowAnonymous}), makeHandler(req => getPersonDetails(req.params.uid, req.user)))
  router.put('/persons/:uid', auth.requireJWT(), makeHandler(req => updatePerson(req.txn, req.params.uid, req.body, req.user), {commit: true}))
  router.put('/persons/:uid/picture', auth.requireJWT(), upload.single('picture'), makeHandler(req => uploadProfilePicture(req.txn, req.params.uid, req.file, req.user), {commit: true}))
  router.get('/persons/:uid/picture/*', makeHandler(req => Model.Person.getProfilePicture(req.txn, req.params.uid), {type: 'send', txn: true}))

  router.put('/nodes/:uid/topics/:name', auth.requireJWT(), makeHandler(req => assignTopic(req.txn, readModels.network.getById(req.params.uid), req.params.name, req.user), {commit: true}))
  router.delete('/nodes/:uid/topics/:name', auth.requireJWT(), makeHandler(req => removeTopic(req.txn, readModels.network.getById(req.params.uid), req.params.name, req.user), {commit: true}))

  router.get('/sessions', makeHandler(req => getSessionList(req.txn), {type: 'send'}))
  return router
}
