module.exports = (dgraphClient, dgraph, QueryFunction, rack) => {
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
    const emailQuery = QueryFunction('Customer', `uid password person { email } @filter(eq(email, "${email}"))`)
    const customer = await emailQuery.one(txn, `func: eq(type, "customer")`)
    return get(txn, customer.uid)
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

  return {create, get, findByAccessCode, findByEMail}
}
