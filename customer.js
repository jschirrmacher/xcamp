const rack = require('hat').rack(128, 36)

module.exports = (dgraphClient, dgraph) => {
  function get(id) {
    let result
    const query = `{
       customer(func: uid(${id})) {
         id: uid
         firm
         name
         email
         addresses {
           address
           postcode
           city
           country
         }
       }
      }`
    const txn = dgraphClient.newTxn()
    return txn.query(query)
      .then(data => data.getJson().customer)
      .then(customer => customer.length ? customer[0] : Promise.reject('Customer not found'))
      .then(customer => result = customer)
      .then(() => txn.discard())
      .then(() => result)
  }

  function findIdByAccessCode(accessCode) {
    let result
    const txn = dgraphClient.newTxn()
    return txn.query(`{customer(func: eq(access_code, "${accessCode}")) {uid}}`)
      .then(data => data.getJson().customer)
      .then(customer => customer.length ? customer[0] : Promise.reject('Customer not found'))
      .then(customer => result = customer.uid)
      .then(() => txn.discard())
      .then(() => result)
  }

  function create(data) {
    let result
    const txn = dgraphClient.newTxn()
    try {
      const mu = new dgraph.Mutation()
      const value = {
        type: 'customer',
        firm: data.firm,
        name: data.firstName + ' ' + data.lastName,
        email: data.email,
        access_code: rack(),
        addresses: {
          type: 'address',
          address: data.address,
          postcode: data.postcode,
          city: data.city,
          country: data.country
        }
      }
      mu.setSetJson(value)
      return txn.mutate(mu)
        .then(assigned => result = assigned.getUidsMap().get('blank-0'))
        .then(uid => txn.commit())
        .then(() => get(result))
        .then(customer => Object.assign({access_code: value.access_code}, customer))
    } catch (error) {
      txn.discard()
      return Promise.reject(error)
    }
  }

  return {create, get, findIdByAccessCode}
}
