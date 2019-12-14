const shortid = require('shortid')

module.exports = (store, readModels) => {
  return {
    async create(data) {
      if (!data.personId) {
        throw 'Missing personId field in Customer.create call'
      }
      data.id = shortid()
      await store.add({type: 'customer-created', customer: data})
      return readModels.customer.getById(data.id)
    },

    async update(id, data) {
      const customer = readModels.customer.getById(id)
      const changes = []
      Object.keys(data).forEach(field => {
        if (customer[field] !== data[field]) {
          changes.push({[field]: data[field]})
        }
      })
      await store.add({type: 'customer-updated', id, ...changes})
      return customer
    }
  }
}
