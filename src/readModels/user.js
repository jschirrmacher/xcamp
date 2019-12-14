module.exports = function ({models}) {
  const byAccessCode = {}
  const users = {}
  const personIdByInvoiceId = {}

  let adminIsDefined = false

  return {
    handleEvent(event, assert) {
      switch (event.type) {
        case 'customer-created':
          if (event.customer.access_code) {
            setUser(event.customer.personId, event.customer.access_code)
          }
          break

        case 'person-created':
          if (event.person.access_code) {
            setUser(event.person.id, event.person.access_code)
          }
          break

        case 'password-changed':
          assert(users[event.userId], `Referenced user ${event.userId} doesn't exist`)
          setUser(event.userId, null, event.passwordHash)
          break

        case 'set-mail-hash':
          assert(users[event.userId], `Referenced user ${event.userId} doesn't exist`)
          setUser(event.userId, null, null, event.hash)
          break

        case 'ticket-created':
          personIdByInvoiceId[event.ticket.invoiceId] = event.ticket.personId
          if (event.ticket.access_code) {
            setUser(event.ticket.personId, event.ticket.access_code)
          }
          break

        case 'invoice-created':
          if (event.invoice.ticketType === 'orga') {
            const customer = models.customer.getById(event.invoice.customerId)
            assert(customer, `Referenced customer ${event.invoice.customerId} doesn't exist`)
            setUser(customer.personId, null, null, null, true)
            adminIsDefined = true
          }
          break
      }
    },

    getAll() {
      return Object.keys(users).map(getUser)
    },

    getById(userId) {
      const user = users[userId]
      if (user) {
        return getUser(userId)
      }
      throw Error(`User '${userId}' doesn't exist`)
    },

    getByAccessCode(accessCode) {
      const id = byAccessCode[accessCode]
      if (id) {
        const user = users[id]
        if (user) {
          return getUser(id)
        }
      }
      throw Error(`No user found with this access code`)
    },

    getByEMail(email) {
      const person = models.person.getByEMail(email)
      if (person) {
        return getUser(person.id)
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
      clear(byAccessCode)
      clear(users)
      clear(personIdByInvoiceId)
    }
  }

  function setUser(id, access_code, password = null, hash = null, isAdmin = null) {
    if (!users[id]) {
      users[id] = {password, hash, isAdmin}
    } else {
      users[id].password = password || users[id].password
      users[id].hash = hash || users[id].hash
      users[id].isAdmin = isAdmin !== null ? isAdmin : users[id].isAdmin
    }
    if (access_code) {
      users[id].access_code = access_code
      byAccessCode[access_code] = id
    }
  }

  function getUser(id) {
    const person = models.person.getById(id)
    if (person) {
      return Object.assign({
        id,
        personId: person.id,
        email: person.email,
        firstName: person.firstName,
        image: person.image || 'user.png'
      }, users[id])
    }
  }
}
