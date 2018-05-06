module.exports = (name, fields) => {
  async function exec(txn, where) {
    const data = await txn.query(`{data(${where}) {${fields}}}`)
    return data.getJson().data
  }

  return {
    all: async (txn, where, rejectIfNotFound = true) => {
      const data = await exec(txn, where)
      if (!data.length) {
        return rejectIfNotFound ? Promise.reject(`${name} not found`) : []
      }
      return data
    },

    one: async (txn, where, rejectIfNotFound = true) => {
      const data = await exec(txn, where)
      if (!data.length) {
        return rejectIfNotFound ? Promise.reject(`${name} not found`) : {}
      }
      return data[0]
    }
  }
}
