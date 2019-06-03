module.exports = function ({models}) {
  const users = {
    byId: {},
    byEMail: {},
    byAccessCode: {},
    byPersonId: {}
  }
  const persons = {}
  const tickets = {}
  const customersByInvoiceId = {}
  let adminIsDefined = false

  return {
    handleEvent(event, assert) {
      switch (event.type) {
        case 'customer-created': {
          assert(!users.byId[event.customer.id], `Referenced user ${event.customer.id} already exists`)
          assert(!users.byAccessCode[event.customer.access_code], `Access code already in use`)
          assert(event.customer.personId, `No personId found in event`)
          const person = models.network.getById(event.customer.personId)
          assert(!users.byEMail[person.email], `Referenced user ${person.email} already exists`)
          setUser({
            id: event.customer.id,
            personId: person.id,
            type: 'customer',
            access_code: event.customer.access_code,
            email: person.email,
            firstName: person.firstName,
            image: 'user.png',
            ticketIds: []
          })
          break
        }

        case 'person-created':
        case 'person-updated':
          persons[event.person.id] = Object.assign(persons[event.person.id] || {}, event.person)
          const user = users.byPersonId[event.person.id]
          if (user) {
            user.firstName = event.person.firstName || user.firstName
            user.image = event.person.image || user.image
          }
          break

        case 'password-changed':
          assert(users.byId[event.userId], `Referenced user ${event.userId} doesn't exist`)
          setUser(Object.assign(users.byId[event.userId], {password: event.passwordHash}))
          break

        case 'set-mail-hash':
          assert(users.byId[event.userId], `Referenced user ${event.userId} doesn't exist`)
          setUser(Object.assign(users.byId[event.userId], {hash: event.hash}))
          break

        case 'invoice-created':
          if (event.invoice.ticketType === 'orga') {
            assert(users.byId[event.invoice.customerId], `Referenced user ${event.invoice.customerId} doesn't exist`)
            setUser(Object.assign(users.byId[event.invoice.customerId], {isAdmin: true}))
            adminIsDefined = true
          }
          customersByInvoiceId[event.invoice.id] = event.invoice.customerId
          break

        case 'invoice-deleted':

          break

        case 'ticket-created': {
          if (!event.ticket.id) {
            event.ticket.id = 'user-' + (users.byId.length + 1)
          }
          const person = models.network.getById(event.ticket.personId)
          const customer = users.byPersonId[event.ticket.personId]
          tickets[event.ticket.id] = event.ticket
          if (customer) {
            users.byAccessCode[event.ticket.access_code] = customer
            users.byId[event.ticket.id] = customer
          } else {
            setUser({
              id: event.ticket.id,
              personId: person.id,
              type: 'ticket',
              access_code: event.ticket.access_code,
              email: person.email,
              firstName: person.firstName,
              image: person.image,
              ticketIds: [event.ticket.id]
            })
          }
          users.byId[customersByInvoiceId[event.ticket.invoiceId]].ticketIds.push(event.ticket.id)
          break
        }

        case 'participant-set': {
          assert(event.personId, 'No personId found in event')
          const ticketUser = users.byId[event.ticketId]
          const person = persons[event.personId]
          if (ticketUser.type === 'customer') {
            const ticket = tickets[event.ticketId]
            setUser({
              id: event.ticketId,
              personId: event.personId,
              type: 'ticket',
              access_code: ticket.access_code,
              email: person.email,
              firstName: person.firstName,
              image: person.image,
              ticketIds: [event.ticketId]
            })
          } else {
            setUser(Object.assign(ticketUser, {email: person.email, firstName: person.firstName, image: person.image}))
          }
          break
        }
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

  function setUser(user) {
    users.byId[user.id] = user
    users.byPersonId[user.personId] = user
    users.byAccessCode[user.access_code] = user
    if (!users.byEMail[user.email] || users.byEMail[user.email].type === user.type) {
      users.byEMail[user.email] = user
    }
  }
}
