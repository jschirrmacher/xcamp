module.exports = (dgraphClient, QueryFunction) => {
  const query = QueryFunction('User', `
    uid
    type
    access_code
    password
    hash`
  )

  async function get(txn, uid) {
    return query.one(txn, `func: uid("${uid}")`)
  }

  async function findByAccessCode(txn, accessCode) {
    return query.one(txn, `func: eq(access_code, "${accessCode}")`)
  }

  return {get, findByAccessCode}
}
