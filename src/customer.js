module.exports = (dgraphClient, dgraph, QueryFunction, rack, store) => {
  const query = QueryFunction('Customer', `
    uid
    type
    firm
    access_code
    password
    hash
    isAdmin,
    person { uid firstName lastName email }
    addresses { address postcode city country }
    invoices { uid tickets { uid participant { uid } } }`
  )

  async function get(txn, uid) {
    return query.one(txn, `func: uid(${uid})`)
  }

  async function findByAccessCode(txn, accessCode) {
    return query.one(txn, `func: eq(access_code, "${accessCode}")`)
  }

  async function findByEMail(txn, email) {
    const emailQuery = QueryFunction('Customer', `uid password person @filter(eq(email, "${email}")) { email }`)
    const customer = await emailQuery.all(txn, `func: eq(type, "customer")`)
    const result = customer.find(entry => entry.person)
    return get(txn, result.uid)
  }

  async function create(txn, customerData) {
    const data = {
      type: 'customer',
      firm: customerData.firm,
      person: {
        type: 'person',
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        name: customerData.firstName + ' ' + customerData.lastName,
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
    const result = await get(txn, assigned.getUidsMap().get('blank-0'))

    store.add({
      type: 'customer-added',
      customer: {
        id: result.uid,
        firm: result.firm,
        address: data.addresses.address,
        postcode: data.addresses.postcode,
        city: data.addresses.city,
        country: data.addresses.country,
        access_code: result.access_code,
        person: {
          id: result.person[0].uid,
          firstName: result.person[0].firstName,
          lastName: result.person[0].lastName,
          email: result.person[0].email
        }
      }
    })
    return result
  }

  return {create, get, findByAccessCode, findByEMail}
}
