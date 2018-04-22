module.exports = dgraphClient => ({
  create: data => {
    let result
    try {
      return dgraphClient.newTxn()
        .query(`{
           all(func: eq(type, "topic")) {
             id: uid
             name
           }
          }`)
        .then(topics => data.topics.map(topic => {
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
            image: data.image,
            description: data.description,
            url: data.url,
            twitterName: data.twitterName,
            topic: topics,
            shape: 'circle'
          })
          return txn.mutate(mu)
        })
        .then(assigned => result = assigned.getUidsMap())
        .then(() => txn.commit())
        .then(result)
    } catch (error) {
      txn.discard()
      return Promise.reject(error)
    }
  },

  get: id => {
    let result
    const query = `{
       person(func: uid(${rid})) {
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
    return dgraphClient
      .newTxn()
      .query(query)
      .then(data => data.getJson().person)
      .then(persons => persons.length ? persons[0] : Promise.reject('Person not found'))
      .then(person => result = person)
      .then(() => txn.discard())
      .then(result)
  }
})
