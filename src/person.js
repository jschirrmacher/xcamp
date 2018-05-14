module.exports = (dgraphClient, dgraph, QueryFunction) => {
  const query = QueryFunction('Person', `
    uid
    firstName
    lastName
    email
    image
    isDark
    description
    url
    twitterName
    topic {
      uid
      name
    }
  `)

  const topicQuery = QueryFunction('Topic', 'uid name')

  async function get(txn, uid) {
    return await query.one(txn, `func: uid(${uid})`)
  }

  async function getPublicDetails(txn, uid) {
    const person = await get(txn, uid)
    delete person.email
    return person
  }

  async function getByEMail(txn, email) {
    return await query.one(txn, `func: eq(email, "${email}")`)
  }

  async function getOrCreate(txn, data) {
    let person = {}
    try {
      person = await getByEMail(txn, data.email)
    } catch(e) {}
    return upsert(txn, person, data)
  }

  async function mapPersonData(txn, currentData, newData) {
    if (newData.topics) {
      const allTopics = await topicQuery.all(txn, 'func: eq(type, "topic")', false)
      newData.topics = newData.topics.map(topic => {
        return allTopics.find(t => t.name === topic.name) || Object.assign(topic, {type: 'topic'})
      })
    }
    const newValues = [{type: 'person'}]
    Object.keys(newData).forEach(key => {
      const obj = {}
      obj[key] = newData[key]
      newValues.push(obj)
    })
    const newObject = Object.assign(currentData, ...newValues)
    newObject.name = newObject.firstName + ' ' + newObject.lastName
    return newObject
  }

  async function upsert(txn, person, data) {
    const mu = new dgraph.Mutation()
    const json = await mapPersonData(txn, person, data)
    mu.setSetJson(json)
    const assigned = await txn.mutate(mu)
    if (!person.uid) {
      person.uid = assigned.getUidsMap().get('blank-0')
    }
    return await get(txn, person.uid)
  }

  return {get, getPublicDetails, getByEMail, upsert, getOrCreate}
}
