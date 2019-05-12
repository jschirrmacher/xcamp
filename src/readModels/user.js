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
          assert(!users.byId[event.customer.id], `Referenced user ${event.customer.id} already exists`)
          assert(!users.byAccessCode[event.customer.access_code], `Access code already in use`)
          const email = models.person.getById(event.customer.personId).email
          assert(!users.byEMail[email], `Referenced user ${email} already exists`)
          addUser({
            id: event.customer.id,
            type: 'customer',
            access_code: event.customer.access_code,
            email
          })
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

        case 'ticket-created':
          addUser({
            id: event.ticket.id,
            type: 'ticket',
            access_code: event.ticket.access_code,
            email: models.person.getById(event.ticket.personId).email
          })
          break

        case 'participant-set':
          users.byId[event.ticketId].email = models.person.getById(event.personId).email
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

  function addUser(user) {
    users.byId[user.id] = user
    users.byAccessCode[user.access_code] = user
    users.byEMail[user.email] = user
  }
}
