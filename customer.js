const rack = require('hat').rack(128, 36)

module.exports = (dgraphClient, dgraph) => {
  async function get(txn, id) {
    const query = `{ customer(func: uid(${id})) {
      id: uid
      firm
      name
      email
      access_code
      addresses {
        address
        postcode
        city
        country
      }
    }}`
    const data = await txn.query(query)
    const customer = data.getJson().customer
    return customer.length ? customer[0] : Promise.reject('Customer not found')
  }

  async function findIdByAccessCode(txn, accessCode) {
    const data = await txn.query(`{customer(func: eq(access_code, "${accessCode}")) {uid}}`)
    const customer = data.getJson().customer
    return customer.length ? customer[0].uid : Promise.reject('Customer not found')
  }

  async function create(txn, customerData) {
    const data = {
      type: 'customer',
      firm: customerData.firm,
      name: customerData.firstName + ' ' + customerData.lastName,
      email: customerData.email,
      access_code: rack(),
      addresses: {
        type: 'address',
        address: customerData.address,
        postcode: customerData.postcode,
        city: customerData.city,
        country: customerData.country
      }
    }

    const mu = new dgraph.Mutation()
    mu.setSetJson(data)
    const assigned = await txn.mutate(mu)
    return get(txn, assigned.getUidsMap().get('blank-0'))
  }

  return {create, get, findIdByAccessCode}
}
