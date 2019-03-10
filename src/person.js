const fs = require('fs')
const path = require('path')

module.exports = (dgraphClient, dgraph, QueryFunction, Topic, store) => {
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
    topics {
      uid
      name
    }
  `)

  const topicQuery = QueryFunction('Topic', 'uid name')

  async function get(txn, uid) {
    const person = await query.one(txn, `func: uid(${uid})`)
    if (!person.image) {
      person.image = 'user.png'
    } else if (person.image.match(/^\w+\/\w+:.*$/)) {
      person.image = 'persons/' + uid + '/picture/' + encodeURIComponent(person.image.replace(/.*:/, ''))
    } else if (person.image.match(/^persons\/0x\w+\/picture$/)) {
      person.image += '/picture'
    }
    person.id = person.uid
    person.name = person.firstName + ' ' + person.lastName
    return person
  }

  function canAdmin(user, uid) {
    if (!user) {
      return false
    } else if (user.isAdmin) {
      return true
    } else if (user.type === 'customer') {
      return user.invoices[0].tickets.some(ticket => ticket.participant[0].uid === uid)
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
        const ticket = user.invoices[0].tickets.find(ticket => ticket.participant[0].uid === uid)
        if (ticket) {
          person.access_code = ticket.access_code
        }
      } else {
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
      return upsert(txn, person, data, user)
    } catch (e) {
      return person   // person exists but user don't have write access, so just return the person
    }
  }

  async function upsert(txn, person, newData, user) {
    if (!canAdmin(user, person.uid)) {
      throw 'Changing this node is not allowed!'
    }
    const mu = new dgraph.Mutation()
    const links2delete = []
    const links2create = []
    const newTopics = []
    if (!person.topics) {
      person.topics = []
    }
    if (newData.topics) {
      const allTopics = await topicQuery.all(txn, 'func: eq(type, "topic")', '', false)
      newData.topics = newData.topics.map(topic => {
        topic.name = topic.name.trim()
        const currentTopic = allTopics.find(t => !t.name.localeCompare(topic.name)) || Object.assign(topic, {type: 'topic'})
        const index = person.topics.findIndex(t => !t.name.localeCompare(topic.name))
        if (index >= 0) {
          person.topics.splice(index, 1)
        } else {
          links2create.push({source: {id: person.uid}, target: {id: currentTopic.uid, ...currentTopic}})
          if (!currentTopic.uid) {
            newTopics.push({index: links2create.length -1, ...currentTopic})
          }
        }
        return currentTopic
      })
    }
    person.topics.forEach(topic => {
      links2delete.push({source: {id: person.uid}, target: {id: topic.uid}})
      mu.setDelNquads(`<${person.uid}> <topics> <${topic.uid}> .`)
    })
    const newValues = [{type: 'person'}]
    Object.keys(newData).forEach(key => {
      const obj = {}
      obj[key] = newData[key]
      newValues.push(obj)
    })
    const newObject = Object.assign(person, ...newValues)
    newObject.name = newObject.firstName + ' ' + newObject.lastName
    mu.setSetJson(newObject)

    const assigned = await txn.mutate(mu)
    if (!person.uid) {
      person.uid = assigned.getUidsMap().get('blank-0')
    }
    person = await get(txn, person.uid)
    store.add({type: 'person-updated', person})
    const nodes2create = await Promise.all(newTopics
      .map(n => {
        const topic = person.topics.find(t => t.name === n.name)
        links2create[n.index].target.id = topic.uid
        return topic
      })
      .map(async n => ({id: n.uid, numLinks: 1, ...await Topic.get(txn, n.uid)}))
    )
    return {links2create, links2delete, nodes2create, node: person}
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

  return {get, getPublicDetails, getByEMail, upsert, updateById, uploadProfilePicture, getProfilePicture, getOrCreate}
}
