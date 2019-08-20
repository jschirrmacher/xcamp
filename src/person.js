const fs = require('fs')
const path = require('path')
const shortid = require('shortid')

module.exports = (store, readModels) => {
  async function upsert(person, newData, user) {
    if (!readModels.network.canEdit(user, person.ui)) {
      throw 'Changing this node is not allowed!'
    }
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

    const id = person.ui || shortid()
    const type = person.ui ? 'person-updated' : 'person-created'
    if (!person.ui) {
      newObject.id = id
      nodes2create.push(newObject)
    }
    await store.add({type, person: Object.assign({id}, ...newValues)})
    const currentTalk = readModels.session.getByUserId(id)
    if (newObject.talkReady && !currentTalk) {
      store.add({type: 'talk-published', person: {id, name: newObject.name}, talk: person.talk})
    } else if (!newObject.talkReady && currentTalk) {
      store.add({type: 'talk-withdrawn', person: {id, name: newObject.name}})
    }
    return {links2create: [], links2delete: [], nodes2create, node: newObject}
  }

  async function updateById(id, data, user) {
    const person = readModels.person.getById(id)
    return upsert(person, data, user)
  }

  function getPicturePath(id) {
    const folder = path.join(__dirname, '../profile-pictures/')
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
      fileName = path.join(__dirname, '../public/user.png')
    }
    return {content: fs.readFileSync(fileName), mimeType, name, disposition: 'inline'}
  }

  return {upsert, updateById, uploadProfilePicture, getProfilePicture}
}
