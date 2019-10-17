module.exports = function () {
  const customers = {
    byId: {}
  }

  return {
    dependencies: ['user'],

    handleEvent(event, assert) {
      switch (event.type) {
        case 'customer-created':
          assert(event.customer, 'No customer in event')
          assert(event.customer.id, 'No customer id in event')
          assert(!customers.byId[event.customer.id], 'Customer already exists')
          customers.byId[event.customer.id] = event.customer
          break

        case 'customer-updated':
          assert(event.customer, 'No customer in event')
          assert(event.customer.id, 'No customer id in event')
          assert(customers.byId[event.customer.id], 'Customer doesn\'t exist')
          customers.byId[event.customer.id] = Object.assign(customers.byId[event.customer.id], event.customer)
          break

      }
    },

    getAll() {
      return Object.values(customers.byId)
    },

    getById(id) {
      return customers.byId[id]
    }
  }
}
