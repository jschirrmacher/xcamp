const fs = require('fs')
const path = require('path')

module.exports = (dgraphClient, dgraph, QueryFunction) => {
  const query = QueryFunction('Topic', `uid name`)

  async function get(txn, uid) {
    const topic = await query.one(txn, `func: uid(${uid})`)
    topic.id = topic.uid
    return topic
  }

  async function find(txn, pattern) {
    const topics = await query.all(txn, 'func: eq(type, "topic")', '', false)
    return topics.filter(t => !t.name.localeCompare(pattern))
  }

  async function upsert(txn, topic, newData, user) {

  }

  return {get, find, upsert}
}
