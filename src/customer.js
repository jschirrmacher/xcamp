module.exports = (dgraphClient, dgraph, QueryFunction, rack, store) => {
  const query = QueryFunction('Customer', `
    uid
    type
    firm
    access_code
    password
    hash
    isAdmin
    person { uid firstName lastName email image }
    addresses { address postcode city country }
    invoices { uid invoiceNo tickets { uid access_code participant { uid } } }`
  )

  async function get(txn, uid, rejectIfNotFound = true) {
    return query.one(txn, `func: uid(${uid})`, '', rejectIfNotFound)
  }

  async function findByAccessCode(txn, accessCode, rejectIfNotFound = true) {
    return query.one(txn, `func: eq(access_code, "${accessCode}")`, '', rejectIfNotFound)
  }

  async function findByEMail(txn, email, rejectIfNotFound = true) {
    const emailQuery = QueryFunction('Customer', `uid password person @filter(eq(email, "${email}")) { email }`)
    const customer = await emailQuery.all(txn, `func: eq(type, "customer")`, '', rejectIfNotFound)
    const result = customer.find(entry => entry.person)
    if (!result) {
      return null
    }
    return get(txn, result.uid)
  }

  async function create(txn, customerData) {
    if (await findByEMail(txn, customerData.email, false)) {
      throw {status: 409, message: 'A customer with this email address already exists'}
    }

    const data = {
      type: 'customer',
      firm: customerData.firm,
      person: {
        type: 'person',
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        name: customerData.firstName + ' ' + customerData.lastName,
        email: customerData.email,
        profession: customerData.profession
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
      type: 'person-created',
      person: {
        id: result.person[0].uid,
        firstName: result.person[0].firstName,
        lastName: result.person[0].lastName,
        email: result.person[0].email,
        profession: customerData.profession
      }
    })
    store.add({
      type: 'customer-created',
      customer: {
        id: result.uid,
        firm: result.firm,
        address: data.addresses.address,
        postcode: data.addresses.postcode,
        city: data.addresses.city,
        country: data.addresses.country,
        access_code: data.access_code,
        personId: result.person[0].uid,
      }
    })
    return result
  }

  return {create, get, findByAccessCode, findByEMail}
}
