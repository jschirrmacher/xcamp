const fs = require('fs')
const path = require('path')

module.exports = (dgraphClient, dgraph, QueryFunction, Model, store, readModels) => {
  const query = QueryFunction('Person', `
    uid
    type
    firstName
    lastName
    email
    image
    isDark
    description
    url
    twitterName
    me
    talk
    talkReady
    topics {
      uid
      name
    }
  `)

  const topicQuery = QueryFunction('Topic', 'uid name')

  async function get(txn, uid) {
    const person = await query.one(txn, `func: uid(${uid})`)
    person.id = person.uid
    person.name = person.firstName + ' ' + person.lastName
    person.talkReady = person.talkReady ? 'checked' : null
    return person
  }

  function canAdmin(user, uid) {
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

  async function getPublicDetails(txn, uid, user) {
    const person = await get(txn, uid)
    if (canAdmin(user, uid)) {
      person.editable = true
      if (user && user.type === 'customer') {
        const tickets = user.invoices[0].tickets
        if (user.invoices[0].invoiceNo) {
          person.accountPath = tickets.length > 1 ? 'accounts/my' : 'accounts/my/invoices/current'
        }
        const ticket = tickets.find(ticket => ticket.participant[0].uid === uid)
        if (ticket) {
          person.access_code = ticket.access_code
        }
      } else {
        person.accountPath = 'accounts/my/invoices/current'
        person.access_code = user.access_code
      }
    } else {
      delete person.email
    }
    return person
  }

  async function getByEMail(txn, email) {
    return await query.one(txn, `func: eq(email, "${email}")`)
  }

  async function getOrCreate(txn, data, user) {
    let person = {}
    try {
      person = await getByEMail(txn, data.email)
    } catch(e) {}
    try {
      const result = await upsert(txn, person, data, user)
      return result.node
    } catch (e) {
      return person   // person exists but user don't have write access, so just return the person
    }
  }

  async function upsert(txn, person, newData, user) {
    if (!canAdmin(user, person.uid)) {
      throw 'Changing this node is not allowed!'
    }
    const mu = new dgraph.Mutation()
    const nodes2create= []
    const newValues = []
    if (newData.name && !newData.firstName && !newData.lastName) {
      [newData.firstName, newData.lastName] = newData.name.split(/ (.*)/)
    }
    Object.keys(newData).forEach(key => {
      if (person[key] !== newData[key]) {
        const obj = {}
        obj[key] = newData[key]
        newValues.push(obj)
      }
    })
    const newObject = Object.assign({}, person, ...newValues, {type: 'person'})
    newObject.talkReady = newObject.talkReady === 'checked'
    newObject.name = newObject.firstName + ' ' + newObject.lastName
    mu.setSetJson(newObject)

    const assigned = await txn.mutate(mu)
    if (!person.uid) {
      person.uid = assigned.getUidsMap().get('blank-0')
      newValues.push({id: person.uid})
      nodes2create.push(newObject)
    }
    const currentTalk = readModels.talks.getByUserId(person.uid)
    if (newObject.talkReady && !currentTalk) {
      store.add({type: 'talk-published', person: {id: person.uid, name: newObject.name}, talk: person.talk})
    } else if (!newObject.talkReady && currentTalk) {
      store.add({type: 'talk-withdrawn', person: {id: person.uid, name: newObject.name}})
    }
    person = await get(txn, person.uid)
    store.add({type: 'person-updated', person: Object.assign({id: person.uid}, ...newValues)})
    return {links2create: [], links2delete: [], nodes2create, node: person}
  }

  async function updateById(txn, id, data, user) {
    const person = await get(txn, id)
    return upsert(txn, person, data, user)
  }

  function getPicturePath(id) {
    const folder = path.join(__dirname, '../profile-pictures/')
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder)
    }
    return path.join(folder, id)
  }

  async function uploadProfilePicture(txn, id, file, user) {
    const person = await get(txn, id)
    const fileName = getPicturePath(id)
    if (fs.existsSync(fileName)) {
      fs.unlinkSync(fileName)
    }
    fs.renameSync(file.path, fileName)
    return await upsert(txn, person, {image: file.mimetype + ':' + file.originalname}, user)
  }

  async function getProfilePicture(txn, id) {
    const person = await get(txn, id)
    const [mimeType, name] = person.image.split(':', 1)
    let fileName = getPicturePath(id)
    if (!fs.existsSync(fileName)) {
      fileName = path.join(__dirname, '../public/user.png')
    }
    return {content: fs.readFileSync(fileName), mimeType, name, disposition: 'inline'}
  }

  async function assignTopic(txn, personId, topicName, user) {
    if (!canAdmin(user, personId)) {
      throw 'Changing this node is not allowed!'
    }
    const links2create = []
    const links2delete = []
    const nodes2create = []
    topicName = topicName.trim()
    const topicNameLower = topicName.toLowerCase()
    const person = await get(txn, personId)
    if (!person.topics.some(t => !t.name.toLowerCase().localeCompare(topicNameLower))) {
      const allTopics = await topicQuery.all(txn, 'func: eq(type, "topic")', '', false)
      const topic = allTopics.find(t => !t.name.toLowerCase().localeCompare(topicNameLower))
      const mu = new dgraph.Mutation()
      if (topic) {
        topic.id = topic.uid
        person.topics.push(topic)
        links2create.push({source: {id: personId}, target: {id: topic.id, ...topic}})
        mu.setSetNquads(`<${personId}> <topics> <${topic.id}> .`)
        store.add({type: 'person-topic-linked', personId, topicid: topic.id})
      } else {
        const result = await Model.Topic.upsert(txn, {}, {name: topicName}, user)
        store.add({type: 'topic-created', topic: result.node})
        person.topics.push(result.node)
        nodes2create.push(result.node)
        links2create.push({source: {id: personId}, target: {id: result.node.uid, ...result.node}})
        mu.setSetNquads(`<${personId}> <topics> <${result.node.id}> .`)
        store.add({type: 'person-topic-linked', personId, topicId: result.node.id})
      }
      await txn.mutate(mu)
    }
    return {links2create, links2delete, nodes2create, node: person}
  }

  async function removeTopic(txn, personId, topicName, user) {
    if (!canAdmin(user, personId)) {
      throw 'Changing this node is not allowed!'
    }
    const person = await get(txn, personId)
    const topicIndex = person.topics.findIndex(t => !t.name.toLowerCase().localeCompare(topicName.toLowerCase()))
    const links2delete = []
    if (topicIndex >= 0) {
      const topic = person.topics[topicIndex]
      const mu = new dgraph.Mutation()
      mu.setDelNquads(`<${person.uid}> <topics> <${topic.uid}> .`)
      await txn.mutate(mu)
      links2delete.push({source: {id: personId}, target: {id: topic.uid}})
      person.topics = person.topics.filter(t => t.uid !== topic.uid)
      store.add({type: 'person-topic-unlinked', personId, topicId: topic.uid})
    }
    return {links2delete, node: person}
  }

  return {get, getPublicDetails, getByEMail, upsert, updateById, uploadProfilePicture, getProfilePicture, getOrCreate, assignTopic, removeTopic}
}
