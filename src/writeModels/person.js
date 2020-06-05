const fs = require('fs')
const path = require('path')

module.exports = (store, readModels, config, adapters) => {
  const { userAdded } = require('../events')({ models: readModels })
  const rocketChat = adapters.RocketChat

  async function getOrCreate(data) {
    return readModels.user.getByEMail(data.email, false) || await create(data)
  }

  async function create(data) {
    if (readModels.user.getByEMail(data.email, false)) {
      throw 'A person with this email address already exist'
    }
    if (data.name && !data.firstName && !data.lastName) {
      [data.firstName, data.lastName] = data.name.split(/ (.*)/)
    }
    const person = {
      email: data.email,
      name: data.firstName + ' ' + data.lastName,
      username: data.email.replace('@', '_').toLowerCase(),
      password: 'test123',
      sendWelcomeEmail: true,
      customFields: {
        firstName: data.firstName,
        lastName: data.lastName
      }
    }
    const user = await rocketChat.createUser(person)
    await store.emit(userAdded, user)
    return readModels.user.getById(user.id)
  }

  async function update(id, newData, user = null) {
    if (!readModels.network.canEdit(user, id)) {
      throw 'Changing this node is not allowed!'
    }
    const person = readModels.person.getById(id)
    if (newData.name && !newData.firstName && !newData.lastName) {
      [newData.firstName, newData.lastName] = newData.name.split(/ (.*)/)
    }

    const newValues = []
    Object.keys(newData).forEach(key => {
      if (person[key] !== newData[key]) {
        newValues.push({[key]: newData[key]})
      }
    })
    const newObject = Object.assign({}, person, ...newValues)
    newObject.talkReady = newObject.talkReady === 'checked'
    newObject.name = newObject.firstName + ' ' + newObject.lastName

    await store.add({type: 'person-updated', person: Object.assign({id}, ...newValues)})
    const currentTalk = readModels.session.getByUserId(id)
    if (newObject.talkReady && !currentTalk) {
      store.add({type: 'talk-published', person: {id, name: newObject.name}, talk: person.talk})
    } else if (!newObject.talkReady && currentTalk) {
      store.add({type: 'talk-withdrawn', person: {id, name: newObject.name}})
    }
    return newObject
  }

  async function upsert(person, newData, user = null) {
    if (readModels.person.getByEMail(person.email)) {
      return update(person.id, newData, user)
    }
    return create(newData)
  }

  async function updateById(id, data, user) {
    const person = readModels.person.getById(id)
    return upsert(person, data, user)
  }

  function getPicturePath(id) {
    const folder = path.join(config.basePath, 'profile-pictures')
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder)
    }
    return path.join(folder, id)
  }

  async function uploadProfilePicture(id, file, user) {
    const person = readModels.person.getById(id)
    const fileName = getPicturePath(id)
    if (fs.existsSync(fileName)) {
      fs.unlinkSync(fileName)
    }
    fs.renameSync(file.path, fileName)
    return await upsert(person, {...person, image: file.mimetype + ':' + file.originalname}, user)
  }

  function getProfilePicture(id) {
    const person = readModels.person.getById(id)
    const [mimeType, name] = person.image.split(':')
    let fileName = getPicturePath(id)
    if (!fs.existsSync(fileName)) {
      fileName = path.join(config.basePath, 'content', 'assets', 'img', 'user.png')
    }
    return {content: fs.readFileSync(fileName), mimeType, name, disposition: 'inline'}
  }

  return {getOrCreate, create, update, upsert, updateById, uploadProfilePicture, getProfilePicture}
}
