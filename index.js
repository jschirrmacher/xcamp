const dgraph = require('dgraph-js')
const grpc = require('grpc')

const clientStub = new dgraph.DgraphClientStub('localhost:9080', grpc.credentials.createInsecure())
const dgraphClient = new dgraph.DgraphClient(clientStub)

const express = require('express')
const bodyParser = require('body-parser')
const app = express()
app.set('json spaces', 2)

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

app.use((req, res, next) => {
  console.log(req.method, req.path)
  next()
})

async function dropAll(dgraphClient) {
  const op = new dgraph.Operation()
  op.setDropAll(true)
  await dgraphClient.alter(op)
}

async function setSchema(dgraphClient) {
  const op = new dgraph.Operation()
  op.setSchema(`type: string @index(term) .`)
  await dgraphClient.alter(op)
}

app.use('/', express.static(__dirname + '/public'))
app.use('/js-netvis', express.static(__dirname + '/node_modules/js-netvis'))

app.post('/person', (req, res) => {
  const txn = dgraphClient.newTxn()
  try {
    dgraphClient.newTxn().query(`{
       all(func: eq(type, "topic")) {
         id: uid
         name
       }
      }`)
      .then(topics => req.body.topics.map(topic => {
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
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          name: req.body.firstName + ' ' + req.body.lastName,
          image: req.body.image,
          description: req.body.description,
          url: req.body.url,
          twitterName: req.body.twitterName,
          topic: topics,
          shape: 'circle'
        })
        return txn.mutate(mu)
      })
      .then(assigned => res.json(assigned.getUidsMap()))
      .then(() => txn.commit())
      .catch(error => res.json({error}))
  } catch (error) {
    txn.discard()
    res.json({error})
  }
})

app.get('/person/:id', (req, res) => {
  const query = `{
   person(func: uid(${req.params.id})) {
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
  dgraphClient.newTxn().query(query)
    .then(data => res.json(data.getJson().person[0]))
    .catch(error => res.json({error}))
})

app.get('/data', (req, res) => {
  const query = `{
   all(func: anyofterms(type, "person topic")) {
     id: uid
     type
     shape
     name
     image
     topic {
       uid
     }
   }
  }`
  dgraphClient.newTxn().query(query)
    .then(data => {
      const all = data.getJson().all
      const links = []
      const nodes = all.map(node => {
        const {topic, ...result} = node
        if (topic) {
          topic.forEach(link => links.push({source: node.id, target: link.uid}))
        }
        result.details = '/person/' + result.id
        result.visible = result.type === 'person'
        result.open = result.name === 'XCamp'
        return result
      })
      res.json({nodes, links})
    })
    .catch(error => res.json({error}))
})

app.delete('/', (req, res) => {
  dropAll(dgraphClient)
    .then(() => setSchema(dgraphClient))
    .then(() => res.json({}))
})

const port = 8001
app.listen(port, () => console.log('Running on port ' + port))
