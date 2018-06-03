module.exports = (dgraphClient, QueryFunction) => {
  const query = QueryFunction('Customer', `
    uid
    type
    access_code
    password
    hash`
  )

  async function findByAccessCode(txn, accessCode) {
    return query.one(txn, `func: eq(access_code, "${accessCode}")`)
  }

  return {findByAccessCode}
}
