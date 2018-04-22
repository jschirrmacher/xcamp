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

const person = require('./person')(dgraphClient)

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

async function exec(func, res) {
  return func
    .catch(error => {
      res.status(error.status || 500)
      return ({error: error.message || '' + error})
    })
    .then(res.json)
}

app.use('/', express.static(__dirname + '/public'))
app.use('/js-netvis', express.static(__dirname + '/node_modules/js-netvis'))

app.post('/person', (req, res) => exec(person.create(req.body), res))
app.get('/person/:id', (req, res) => exec(person.get(req.params.id), res))

app.post('/tickets', (req, res) => {
  res.json(req.body)
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
