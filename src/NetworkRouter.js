const path = require('path')
const multer = require('multer')
const upload = multer({dest: path.resolve(__dirname , '..', 'profile-pictures')})

module.exports = (dependencies) => {
  const {
    express,
    auth,
    makeHandler,
    Model,
    store,
    readModels,
    config
  } = dependencies

  function getPersonDetails(id, user) {
    const node = {...readModels.network.getById(id)}
    node.topics = node.links && node.links.topics && node.links.topics.map(id => {
      const linkedNode = readModels.network.getById(id)
      return {id, name: linkedNode.name}
    })
    return readModels.network.getPublicViewOfNode(node, user)
  }

  async function uploadProfilePicture(txn, id, file, user) {
    const result = await Model.Person.uploadProfilePicture(id, file, user)
    result.node = readModels.network.getPublicViewOfNode(result.node, user)
    return result
  }

  async function updatePerson(txn, id, body, user) {
    const result = await Model.Person.updateById(id, body, user)
    result.node = readModels.network.getPublicViewOfNode(result.node, user)
    return result
  }

  async function assignTopic(txn, node, topicName, user) {
    if (!readModels.network.canEdit(user, node.id)) {
      throw 'Changing this node is not allowed!'
    }
    const links2create = []
    const links2delete = []
    const nodes2create = []
    node.links = node.links || {}
    node.links.topics = node.links.topics || []
    const name = topicName.trim()
    const topic = readModels.topic.getByName(name) || await createTopic(name)
    if (!node.links.topics.includes(topic.id)) {
      links2create.push({source: {id: node.id}, target: {id: topic.id, ...topic}})
      store.add({type: 'topic-linked', nodeId: node.id, topicId: topic.id})
    }
    return {links2create, links2delete, nodes2create, node, topic}

    async function createTopic(name) {
      const result = await Model.Topic.upsert(txn, {}, {name}, user)
      nodes2create.push({type: 'topic', ...result.node})
      return result.node
    }
  }

  async function removeTopic(txn, node, topicName, user) {
    if (!readModels.network.canEdit(user, node.id)) {
      throw 'Changing this node is not allowed!'
    }
    const links2delete = []
    const topic = readModels.topic.getByName(topicName)
    node.links = node.links || {}
    node.links.topics = node.links.topics || []
    if (node.links.topics.includes(topic.id)) {
      links2delete.push({source: {id: node.id}, target: {id: topic.id}})
      node.links.topics = node.links.topics.filter(t => t !== topic.id)
      store.add({type: 'topic-unlinked', nodeId: node.id, topicId: topic.id})
    }
    return {links2delete, node}
  }

  async function updateById(id, data, user) {
    const fields = ['name', 'description', 'url']

    if (!user || !user.isAdmin) {
      throw 'Changing this node is not allowed!'
    }
    const node = readModels.network.getById(id)
    const newValues = []
    fields.forEach(key => {
      const obj = {}
      obj[key] = data[key]
      newValues.push(obj)
    })
    Object.assign(node, ...newValues)

    if (!node.uid) {
      node.uid = readModels.network.getMaxId() + 1
    }
    store.add({type: 'node-updated', node: {...newValues}})
    return {links2create: [], links2delete: [], nodes2create: [], node}
  }

  const router = express.Router()
  const allowAnonymous = true

  router.get('/', auth.requireJWT({allowAnonymous}), makeHandler(req => readModels.network.getGraph(req.user, config.eventName)))

  router.put('/roots/:uid', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => updateById(req.params.uid, req.body, req.user)))

  router.get('/topics', makeHandler(req => Model.Topic.find(req.txn, req.query.q), {txn: true}))
  router.put('/topics/:uid', auth.requireJWT(), makeHandler(req => Model.Topic.updateById(req.txn, req.params.uid, req.body, req.user), {commit: true}))

  router.post('/persons', auth.requireJWT(), makeHandler(req => Model.Person.upsert({}, req.body, req.user)))
  router.get('/persons/:uid', auth.requireJWT({allowAnonymous}), makeHandler(req => getPersonDetails(req.params.uid, req.user)))
  router.put('/persons/:uid', auth.requireJWT(), makeHandler(req => updatePerson(req.txn, req.params.uid, req.body, req.user), {commit: true}))
  router.put('/persons/:uid/picture', auth.requireJWT(), upload.single('picture'), makeHandler(req => uploadProfilePicture(req.txn, req.params.uid, req.file, req.user), {commit: true}))
  router.get('/persons/:uid/picture/*', makeHandler(req => Model.Person.getProfilePicture(req.params.uid), {type: 'send'}))

  router.put('/nodes/:uid/topics/*', auth.requireJWT(), makeHandler(req => assignTopic(req.txn, readModels.network.getById(req.params.uid), req.params[0], req.user), {commit: true}))
  router.delete('/nodes/:uid/topics/*', auth.requireJWT(), makeHandler(req => removeTopic(req.txn, readModels.network.getById(req.params.uid), req.params[0], req.user), {commit: true}))

  return router
}
