const path = require('path')
const multer = require('multer')
const shortid = require('shortid')

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

  const upload = multer({dest: path.join(config.basePath, 'profile-pictures')})

  function getPersonDetails(id, user) {
    const node = {...readModels.network.getById(id)}
    node.topics = node.links && node.links.topics && node.links.topics.map(id => {
      const linkedNode = readModels.network.getById(id)
      return {id, name: linkedNode.name}
    })
    return readModels.network.getPublicViewOfNode(node, user)
  }

  function createFrontendInfo(person, user, isNew = false) {
    const node = readModels.network.getPublicViewOfNode(person, user)
    return {links2create: [], links2delete: [], nodes2create: isNew ? [node] : [], node}
  }

  async function uploadProfilePicture(id, file, user) {
    return createFrontendInfo(await Model.Person.uploadProfilePicture(id, file, user), user)
  }

  async function createPerson(data, user) {
    return createFrontendInfo(await Model.Person.create(data), user, true)
  }

  async function updatePerson(id, body, user) {
    return createFrontendInfo(await Model.Person.update(id, body, user), user)
  }

  async function assignTopic(node, topicName, user) {
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
      const node = {id: shortid(), type: 'topic', name}
      await store.add({type: 'node-created', node})
      return readModels.topic.getByName(name)
    }
  }

  async function removeTopic(node, topicName, user) {
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

    if (!node.id) {
      node.id = readModels.network.getMaxId() + 1
    }
    store.add({type: 'node-updated', node: {...newValues}})
    return {links2create: [], links2delete: [], nodes2create: [], node}
  }

  const router = express.Router()
  const allowAnonymous = true

  router.get('/', auth.requireJWT({allowAnonymous}), makeHandler(req => readModels.network.getGraph(req.user, config.eventName)))

  router.put('/roots/:id', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => updateById(req.params.id, req.body, req.user)))

  router.get('/topics', makeHandler(req => readModels.topic.find(req.query.q)))
  router.put('/topics/:id', auth.requireJWT(), makeHandler(req => updateById(req.params.id, req.body, req.user)))

  router.post('/persons', auth.requireJWT(), makeHandler(req => createPerson(req.body, req.user)))
  router.get('/persons/:id', auth.requireJWT({allowAnonymous}), makeHandler(req => getPersonDetails(req.params.id, req.user)))
  router.put('/persons/:id', auth.requireJWT(), makeHandler(req => updatePerson(req.params.id, req.body, req.user)))
  router.put('/persons/:id/picture', auth.requireJWT(), upload.single('picture'), makeHandler(req => uploadProfilePicture(req.params.id, req.file, req.user)))
  router.get('/persons/:id/picture/*', makeHandler(req => Model.Person.getProfilePicture(req.params.id), {type: 'send'}))

  router.put('/nodes/:id/topics/*', auth.requireJWT(), makeHandler(req => assignTopic(readModels.network.getById(req.params.id), req.params[0], req.user)))
  router.delete('/nodes/:id/topics/*', auth.requireJWT(), makeHandler(req => removeTopic(readModels.network.getById(req.params.id), req.params[0], req.user)))

  return router
}
