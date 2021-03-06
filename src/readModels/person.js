module.exports = function () {
  const persons = {
    byId: {},
    byEMail: {},
    byAccessCode: {}
  }

  return {
    handleEvent(event, assert) {
      switch (event.type) {
        case 'person-created':
          assert(event.person, 'No person in event')
          assert(event.person.id, 'No person id in event')
          assert(!persons.byId[event.person.id], 'Person already exists')
          assert(event.person.email, 'Person has no email')
          assert(!persons.byEMail[event.person.email], 'A person with this email address already exists')
          persons.byId[event.person.id] = event.person
          persons.byEMail[event.person.email] = event.person
          if (event.person.access_code) {
            persons.byAccessCode[event.person.access_code] = event.person
          }
          break

        case 'person-updated':
          assert(event.person, 'No person in event')
          assert(event.person.id, 'No person id in event')
          assert(persons.byId[event.person.id], 'Person doesn\'t exist')
          persons.byId[event.person.id] = Object.assign(persons.byId[event.person.id], event.person)
          if (event.person.email) {
            delete(persons.byEMail[event.person.email])
            persons.byEMail[event.person.email] = persons.byId[event.person.id]
          }
          if (event.person.access_code) {
            delete(persons.byAccessCode[event.person.access_code])
            persons.byAccessCode[event.person.access_code] = persons.byId[event.person.id]
          }
          break

      }
    },

    getAll() {
      return Object.values(persons.byId)
    },

    getById(id) {
      return persons.byId[id]
    },

    getByEMail(email) {
      return persons.byEMail[email]
    },

    getByAccessCode(code, throwIfNotFound = false) {
      const person = persons.byAccessCode[code]
      if (!person && throwIfNotFound) {
        throw Error('person not found')
      }
      return person
    }
  }
}
