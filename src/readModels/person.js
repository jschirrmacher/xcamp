module.exports = function ({models, store, config}) {
  const persons = {
    byId: {},
    byEMail: {}
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
          break

        case 'person-updated':
          assert(event.person, 'No person in event')
          assert(event.person.id, 'No person id in event')
          assert(persons.byId[event.person.id], 'Person doesn\'t exist')
          persons.byId[event.person.id] = Object.assign(persons.byId[event.person.id], event.person)
          delete(persons.byEMail[event.person.email])
          persons.byEMail[event.person.email] = event.person
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
    }
  }
}
