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
const payment = require('./payment')

app.use((req, res, next) => {
  console.log(req.method, req.path)
  next()
})

async function exec(func, res) {
  return func
    .catch(error => {
      res.status(error.status || 500)
      return ({error: error.message || '' + error})
    })
    .then(result => res.json(result))
}

function buyTicket(data) {
  function createBuyer(data) {
    return person.create(data)
  }

  function getNetTotals(data) {
    const ticketPrice = data.type === 'corporate' ? 200 : 100
    const numTickets = (!data.buy_for_other ? 0 : 1) + (data.participant_email && data.participant_email.length || 1)
    return numTickets * ticketPrice
  }

  if (!req.body.tos_accepted) {
    return Promise.reject({status: 403, message: 'You need to accept the terms of service'})
  } else {
    return createBuyer(data)
      .then(buyer => {
        const origin = req.headers.origin
        const payPerInvoice = data.payment === 'invoice' && !data.reduced
        const totals = getNetTotals(data)
        const invoiceInfoUrl = origin + '/invoice-info.html'
        const url = payPerInvoice ? invoiceInfoUrl : payment(origin).exec(buyer, data.reduced, totals, true)
        res.redirect(url)
        return {ok: true}
      })
  }
}

app.use('/', express.static(__dirname + '/public'))
app.use('/js-netvis', express.static(__dirname + '/node_modules/js-netvis'))

app.post('/persons', (req, res) => exec(person.create(req.body), res))
app.get('/persons/:id', (req, res) => exec(person.get(req.params.id), res))

app.post('/tickets', (req, res) => exec(buyTicket(req.body), res))

app.post('/session', (req, res) => res.json({status: 'not yet implemented'}))
app.delete('/session', (req, res) => res.json({status: 'not yet implemented'}))

app.post('/account', (req, res) => res.json({status: 'not yet implemented'}))   // register as community user without ticket
app.put('/account/password', (req, res) => res.json({status: 'not yet implemented'}))
app.get('/account/invoices/current', (req, res) => res.json({status: 'not yet implemented'}))

app.get('/network', (req, res) => exec(network.getGraph(), res))
app.delete('/network', (req, res) => exec(network.rebuildAll(), res))

const port = 8001
app.listen(port, () => console.log('Running on port ' + port))
