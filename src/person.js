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

  async function get(txn, uid) {
    const person = await query.one(txn, `func: uid(${uid})`)
    person.id = person.uid
    person.name = person.firstName + ' ' + person.lastName
    person.talkReady = person.talkReady ? 'checked' : null
    return person
  }

  async function getByEMail(txn, email) {
    return await query.one(txn, `func: eq(email, "${email}")`)
  }

  async function getOrCreate(txn, data, user) {
    let person = {}
    try {
      person = await getByEMail(txn, data.email)
    } catch(e) {
      // if email address cannot be found, create a new user
    }
    try {
      const result = await upsert(txn, person, data, user)
      return result.node
    } catch (e) {
      return person   // person exists but user don't have write access, so just return the person
    }
  }

  async function upsert(txn, person, newData, user) {
    if (!readModels.network.canEdit(user, person.uid)) {
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
    const id = person.uid || assigned.getUidsMap().get('blank-0')
    const type = person.uid ? 'person-updated' : 'person-created'
    if (!person.uid) {
      nodes2create.push(newObject)
    }
    store.add({type, person: Object.assign({id}, ...newValues)})
    const currentTalk = readModels.session.getByUserId(id)
    if (newObject.talkReady && !currentTalk) {
      store.add({type: 'talk-published', person: {id, name: newObject.name}, talk: person.talk})
    } else if (!newObject.talkReady && currentTalk) {
      store.add({type: 'talk-withdrawn', person: {id, name: newObject.name}})
    }
    return {links2create: [], links2delete: [], nodes2create, node: await get(txn, id)}
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
    return await upsert(txn, person, {...person, image: file.mimetype + ':' + file.originalname}, user)
  }

  function getProfilePicture(id) {
    const person = readModels.person.getById(id)
    const [mimeType, name] = person.image.split(':')
    let fileName = getPicturePath(id)
    if (!fs.existsSync(fileName)) {
      fileName = path.join(__dirname, '../public/user.png')
    }
    return {content: fs.readFileSync(fileName), mimeType, name, disposition: 'inline'}
  }

  return {get, getByEMail, upsert, updateById, uploadProfilePicture, getProfilePicture, getOrCreate}
}
