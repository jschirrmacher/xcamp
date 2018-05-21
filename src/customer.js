module.exports = (dgraphClient, dgraph, QueryFunction, rack) => {
  const query = QueryFunction('Customer', `
    uid
    firm
    access_code
    person {
      uid
      firstName
      lastName
      email
    }
    addresses {
      address
      postcode
      city
      country
    }`
  )

  async function get(txn, uid) {
    return query.one(txn, `func: uid(${uid})`)
  }

  async function findByAccessCode(txn, accessCode) {
    return query.one(txn, `func: eq(access_code, "${accessCode}")`)
  }

  async function create(txn, customerData) {
    const data = {
      type: 'customer',
      firm: customerData.firm,
      person: {
        type: 'person',
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        email: customerData.email,
      },
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

  return {create, get, findByAccessCode}
}