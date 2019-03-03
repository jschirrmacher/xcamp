const users = {
  byId: {},
  byEMail: {},
  byAccessCode: {}
}
const logger = console

function getAll() {
  return Object.values(users.byId)
}

function getById(userId) {
  const user = users.byId[userId]
  if (user) {
    return user
  }
  throw `User '${userId}' doesn't exist`
}

function getByAccessCode(accessCode) {
  const user = users.byAccessCode[accessCode]
  if (user) {
    return user
  }
  throw `No user found with this access code`
}

function getByEMail(email) {
  const user = users.byEMail[email]
  if (user) {
    return user
  }
  throw `No user found with this e-mail address`
}

function handleEvent(event) {
  function assert(condition, message) {
    if (!condition) {
      throw `Event '${event.type}' (${event.ts}): ${message}`
    }
  }

  try {
    switch (event.type) {
      case 'customer-added':
        assert(!users.byId[event.customer.person.id], `Referenced user ${event.customer.id} already exists`)
        assert(!users.byAccessCode[event.customer.access_code], `Access code already in use`)
        assert(!users.byEMail[event.customer.person.email], `Referenced user ${event.customer.person.email} already exists`)
        const user = {
          uid: event.customer.id,
          id: event.customer.id,
          type: 'customer',
          access_code: event.customer.access_code,
          email: event.customer.person.email
        }
        users.byId[user.id] = user
        users.byAccessCode[user.access_code] = user
        users.byEMail[user.email] = user
        break;

      case 'password-changed':
        assert(users.byId[event.userId], `Referenced user ${event.userId} doesn't exist`)
        users.byId[event.userId].password = event.passwordHash
        break

      case 'set-mail-hash':
        assert(users.byId[event.userId], `Referenced user ${event.userId} doesn't exist`)
        users.byId[event.userId].hash = event.hash
        break
    }
  } catch (error) {
    logger.error(error)
  }
}

module.exports = { handleEvent, getAll, getById, getByAccessCode, getByEMail }
