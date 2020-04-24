const { userAdded, userRemoved } = require('../events')

module.exports = function ({ store }) {
  const byEmail = {}
  const users = {}
  let adminIsDefined = false

  store.on(userAdded, (event, assert) => {
    assert(event.user, 'No user attribute')
    assert(event.user.id, 'No user.id attribute')
    users[event.user.id] = event.user
    byEmail[event.user.email] = event.user
    if (event.user.isAdmin) {
      adminIsDefined = true
    }
  })

  store.on(userRemoved, (event, assert) => {
    assert(event.userId, 'No userId')
    assert(users[event.userId], 'Referenced user doesnt exist')
    delete(byEmail[users[event.userId].email])
    delete(users[event.userId])
  })

  return {
    getAll() {
      return Object.values(users)
    },

    getById(userId) {
      const user = users[userId]
      if (user) {
        return user
      }
      throw Error(`User '${userId}' doesn't exist`)
    },

    getByAccessCode() {
      throw Error(`No user found with this access code`)
    },

    getByEMail(email) {
      const user = byEmail[email]
      if (user) {
        return user
      }
      throw Error(`No user found with this e-mail address`)
    },

    adminIsDefined,

    reset() {
      function clear(obj) {
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj,key)) {
            delete obj[key]
          }
        }
      }
      clear(byEmail)
      clear(users)
    }
  }
}
