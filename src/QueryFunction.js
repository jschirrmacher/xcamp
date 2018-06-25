module.exports = (name, fields) => {
  async function exec(txn, where, filter) {
    filter = filter ? '@filter(' + filter + ')' : ''
    const query = `{data(${where}) ${filter} {${fields}}}`
    const data = await txn.query(query)
    return data.getJson().data
  }

  return {
    all: async (txn, where, filter = '', rejectIfNotFound = true) => {
      const data = await exec(txn, where, filter)
      if (!data.length) {
        return rejectIfNotFound ? Promise.reject(`${name} not found`) : []
      }
      return data
    },

    one: async (txn, where, filter = '', rejectIfNotFound = true) => {
      const data = await exec(txn, where, filter)
      if (!data.length) {
        return rejectIfNotFound ? Promise.reject(`${name} not found`) : {}
      }
      return data[0]
    }
  }
}
