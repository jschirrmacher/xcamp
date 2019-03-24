const fields = ['name', 'description', 'url']

module.exports = (dgraphClient, dgraph, QueryFunction, store) => {
  const query = QueryFunction('Root', 'uid ' + fields.join(' '))

  async function get(txn, id) {
    const root = await query.one(txn, `func: uid(${id})`)
    root.id = root.uid
    return root
  }

  async function find(txn, pattern = '') {
    const roots = await query.all(txn, 'func: eq(type, "root")', '', false)
    return roots.filter(t => t.name.match(new RegExp(pattern, 'i')))
  }

  async function updateById(txn, id, data, user) {
    const root = await get(txn, id)
    return upsert(txn, root, data, user)
  }

  async function upsert(txn, root, newData, user) {
    if (!user) {
      throw 'Changing this node is not allowed!'
    }
    const mu = new dgraph.Mutation()
    const newValues = [{type: 'root'}]
    fields.forEach(key => {
      const obj = {}
      obj[key] = newData[key]
      newValues.push(obj)
    })
    const newObject = Object.assign(root, ...newValues)
    mu.setSetJson(newObject)

    const assigned = await txn.mutate(mu)
    if (!root.uid) {
      root.uid = assigned.getUidsMap().get('blank-0')
    }
    root = await get(txn, root.uid)
    store.add({type: 'root-updated', root})
    return {links2create: [], links2delete: [], nodes2create: [], node: root}
  }

  return {get, find, upsert, updateById}
}
