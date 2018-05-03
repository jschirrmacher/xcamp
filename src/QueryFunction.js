module.exports = (name, fields) => async function (txn, where) {
  const data = await txn.query(`{data(${where}) {${fields}}}`)
  const result = data.getJson().data
  return result.length ? result[0] : Promise.reject(`${name} not found`)
}
