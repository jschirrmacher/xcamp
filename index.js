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
const network = require('./network')(dgraphClient)
const ticket = require('./ticket')(dgraphClient, person, require('./payment'))

app.use((req, res, next) => {
  console.log(req.method, req.path)
  next()
})

async function exec(func, res) {
  return func
    .catch(error => {
      res.status(error.status || 500)
      if (error.status === 302) {
        res.redirect(error.url)
        return {redirectTo: error.url}
      } else {
        return {error: error.message || '' + error}
      }
    })
    .then(result => res.json(result))
}

app.use('/', express.static(__dirname + '/public'))
app.use('/js-netvis', express.static(__dirname + '/node_modules/js-netvis'))

app.post('/persons', (req, res) => exec(person.create(req.body), res))
app.get('/persons/:id', (req, res) => exec(person.get(req.params.id), res))

app.post('/tickets', (req, res) => exec(ticket.buy(req.body), res))

app.post('/session', (req, res) => res.json({status: 'not yet implemented'}))
app.delete('/session', (req, res) => res.json({status: 'not yet implemented'}))

app.post('/account', (req, res) => res.json({status: 'not yet implemented'}))   // register as community user without ticket
app.put('/account/password', (req, res) => res.json({status: 'not yet implemented'}))
app.get('/account/invoices/current', (req, res) => res.json({status: 'not yet implemented'}))

app.get('/network', (req, res) => exec(network.getGraph(), res))
app.delete('/network', (req, res) => exec(network.rebuildAll(), res))

const port = 8001
app.listen(port, () => console.log('Running on port ' + port))
