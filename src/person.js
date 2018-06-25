const fs = require('fs')
const path = require('path')

module.exports = (dgraphClient, dgraph, QueryFunction) => {
  const query = QueryFunction('Person', `
    uid
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
    person.image = person.image ? 'persons/' + uid + '/picture' : 'user.png'
    return person
  }

  function canAdmin(user, uid) {
    if (!user) {
      return false
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
    if (!person.topics) {
      person.topics = []
    }
    if (newData.topics) {
      const allTopics = await topicQuery.all(txn, 'func: eq(type, "topic")', '', false)
      newData.topics = newData.topics.map(topic => {
        person.topics = person.topics.filter(existing => topic.name !== existing.name)
        return allTopics.find(t => t.name === topic.name) || Object.assign(topic, {type: 'topic'})
      })
    }
    person.topics.forEach(topic => mu.setDelNquads(`<${person.uid}> <topics> <${topic.uid}> .`))
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
    return await get(txn, person.uid)
  }

  async function updateById(txn, id, data, user) {
    const person = await get(txn, id)
    await upsert(txn, person, data, user)
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
    const fileName = getPicturePath(id)
    if (fs.existsSync(fileName)) {
      return fs.readFileSync(fileName)
    }
  }

  return {get, getPublicDetails, getByEMail, upsert, updateById, uploadProfilePicture, getProfilePicture, getOrCreate}
}
