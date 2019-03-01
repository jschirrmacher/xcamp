const users = {}
const logger = console

function getAll() {
  return users
}

function getById(userId) {
  if (users[userId]) {
    return users[userId]
  }
  throw `User '${userId}' doesn't exist`
}

function getByAccessCode(accessCode) {
  const user = this.user.find(u => u.access_code === accessCode)
  if (user) {
    return user
  }
  throw `No user found with this access code`
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
        assert(!users[event.customer.id], `Referenced user ${event.customer.id} already exists`)
        users[event.customer.id] = event.customer
        break;

      case 'password-changed':
        assert(users[event.userId], `Referenced user ${event.userId} doesn't exist`)
        users[event.userId].password = event.passwordHash
        break
    }
  } catch (error) {
    logger.error(error)
  }
}

module.exports = { handleEvent, getAll, getById, getByAccessCode }
