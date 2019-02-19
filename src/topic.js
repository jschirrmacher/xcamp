const fields = ['name', 'description', 'url']

module.exports = (dgraphClient, dgraph, QueryFunction) => {
  const query = QueryFunction('Topic', 'uid ' + fields.join(' '))

  async function get(txn, id) {
    const topic = await query.one(txn, `func: uid(${id})`)
    topic.id = topic.uid
    return topic
  }

  async function find(txn, pattern = '') {
    const topics = await query.all(txn, 'func: eq(type, "topic")', '', false)
    return topics.filter(t => t.name.match(new RegExp(pattern, 'i')))
  }

  async function updateById(txn, id, data, user) {
    const topic = await get(txn, id)
    return upsert(txn, topic, data, user)
  }

  async function upsert(txn, topic, newData, user) {
    if (!user) {
      throw 'Changing this node is not allowed!'
    }
    const mu = new dgraph.Mutation()
    const newValues = [{type: 'topic'}]
    Object.keys(fields).forEach(key => {
      const obj = {}
      obj[key] = newData[key]
      newValues.push(obj)
    })
    const newObject = Object.assign(topic, ...newValues)
    mu.setSetJson(newObject)

    const assigned = await txn.mutate(mu)
    if (!topic.uid) {
      topic.uid = assigned.getUidsMap().get('blank-0')
    }
    topic = await get(txn, topic.uid)
    return {links2create: [], links2delete: [], nodes2create: [], node: topic}
  }

  return {get, find, upsert, updateById}
}
