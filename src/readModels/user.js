module.exports = function ({models}) {
  const users = {
    byId: {},
    byEMail: {},
    byAccessCode: {}
  }
  let adminIsDefined = false

  return {
    handleEvent(event, assert) {
      switch (event.type) {
        case 'customer-created':
          const person = models.person.getById(event.customer.personId)
          assert(!users.byId[person.id], `Referenced user ${person.id} already exists`)
          assert(!users.byAccessCode[event.customer.access_code], `Access code already in use`)
          assert(!users.byEMail[person.email], `Referenced user ${person.email} already exists`)
          const user = {
            id: event.customer.id,
            type: 'customer',
            access_code: event.customer.access_code,
            email: person.email
          }
          users.byId[user.id] = user
          users.byAccessCode[user.access_code] = user
          users.byEMail[user.email] = user
          break

        case 'password-changed':
          assert(users.byId[event.userId], `Referenced user ${event.userId} doesn't exist`)
          users.byId[event.userId].password = event.passwordHash
          break

        case 'set-mail-hash':
          assert(users.byId[event.userId], `Referenced user ${event.userId} doesn't exist`)
          users.byId[event.userId].hash = event.hash
          break

        case 'invoice-created':
          if (event.invoice.ticketType === 'orga') {
            assert(users.byId[event.invoice.customerId], `Referenced user ${event.invoice.customerId} doesn't exist`)
            users.byId[event.invoice.customerId].isAdmin = true
            adminIsDefined = true
          }
          break
      }
    },

    getAll() {
      return Object.values(users.byId)
    },

    getById(userId) {
      const user = users.byId[userId]
      if (user) {
        return user
      }
      throw `User '${userId}' doesn't exist`
    },

    getByAccessCode(accessCode) {
      const user = users.byAccessCode[accessCode]
      if (user) {
        return user
      }
      throw `No user found with this access code`
    },

    getByEMail(email) {
      const user = users.byEMail[email]
      if (user) {
        return user
      }
      throw `No user found with this e-mail address`
    },

    adminIsDefined
  }
}
