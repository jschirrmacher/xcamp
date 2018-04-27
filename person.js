module.exports = (dgraphClient, dgraph) => {
  function get(id) {
    let result
    const query = `{
       person(func: uid(${id})) {
         id: uid
         name
         image
         description
         url
         twitterName
         topics: topic {
           name
         }
       }
      }`
    const txn = dgraphClient.newTxn()
    return txn.query(query)
      .then(data => data.getJson().person)
      .then(persons => persons.length ? persons[0] : Promise.reject('Person not found'))
      .then(person => {
        person.topics = person.topics ? person.topics.map(topic => topic.name) : []
        result = person
      })
      .then(() => txn.discard())
      .then(() => result)
  }

  function create(data) {
    let result
    const txn = dgraphClient.newTxn()
    try {
      return txn.query(`{
         all(func: eq(type, "topic")) {
           id: uid
           name
         }
        }`)
        .then(topics => data.topics && data.topics.map(topic => {
          const existing = topics.getJson().all.find(t => t.name === topic.name)
          if (existing) {
            return {uid: existing.id}
          } else {
            return Object.assign({shape: 'rect', type: 'topic'}, topic)
          }
        }))
        .then(topics => {
          const mu = new dgraph.Mutation()
          mu.setSetJson({
            type: 'person',
            firstName: data.firstName,
            lastName: data.lastName,
            name: data.firstName + ' ' + data.lastName,
            email: data.email,
            image: data.image,
            description: data.description,
            url: data.url,
            twitterName: data.twitterName,
            topic: topics || [],
            shape: 'circle'
          })
          return txn.mutate(mu)
        })
        .then(assigned => result = assigned.getUidsMap().get('blank-0'))
        .then(uid => txn.commit())
        .then(() => get(result))
    } catch (error) {
      txn.discard()
      return Promise.reject(error)
    }
  }

  return {create, get}
}
