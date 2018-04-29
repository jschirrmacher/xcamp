const fs = require('fs')
const Mustache = require('Mustache')
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

const Person = require('./person')(dgraphClient, dgraph)
const Customer = require('./customer')(dgraphClient, dgraph)
const Network = require('./network')(dgraphClient, dgraph)
const Ticket = require('./ticket')(dgraphClient, dgraph, Customer, Person, require('./payment'))

app.use((req, res, next) => {
  console.log(req.method, req.path)
  next()
})

async function exec(func, res, type = 'json') {
  return func
    .catch(error => ({isError: true, status: error.status || 500, error: error.message || '' + error}))
    .then(result => {
      if (result && result.isError) {
        res.status(result.status || 500).json({error: result.error.message || '' + result.error})
      } else if (result && result.isRedirection) {
        res.redirect(result.url)
      } else {
        res[type](result)
      }
    })
}

app.use('/', express.static(__dirname + '/public'))
app.use('/js-netvis', express.static(__dirname + '/node_modules/js-netvis/dist'))
app.use('/qrcode', express.static(__dirname + '/node_modules/qrcode/build'))

app.post('/persons', (req, res) => exec(Person.create(req.body), res))
app.get('/persons/:id', (req, res) => exec(Person.get(req.params.id), res))

app.post('/tickets', (req, res) => exec(Ticket.buy(req.body, req.headers.origin), res))

app.post('/accounts', (req, res) => res.status(500).json({error: 'not yet implemented'}))   // register as community user without ticket
app.put('/accounts/:accessCode', (req, res) => res.status(500).json({error: 'not yet implemented'}))
app.get('/accounts/:accessCode', (req, res) => exec(getAccountInfo(req.params.accessCode), res, 'send'))
app.get('/accounts/:accessCode/invoices/current', (req, res) => exec(getLastInvoice(req.params.accessCode), res, 'send'))

app.get('/network', (req, res) => exec(Network.getGraph(), res))
app.delete('/network', (req, res) => exec(Network.rebuild(), res))

const port = 8001
app.listen(port, () => console.log('Running on port ' + port))

async function getAccountInfo(accessCode) {
  const txn = dgraphClient.newTxn()
  const customerId = await Customer.findIdByAccessCode(txn, accessCode)
  const invoice = await Ticket.getLastInvoice(txn, customerId)
  const tickets = invoice.tickets
  return Mustache.render('' + fs.readFileSync(__dirname + '/templates/account-info.html'), {accessCode, tickets})
}

async function getLastInvoice(accessCode) {
  const txn = dgraphClient.newTxn()
  return Customer.findIdByAccessCode(txn, accessCode)
    .then(customerId => Ticket.getLastInvoice(txn, customerId))
    .then(invoice => {
      const netAmount = invoice.tickets.length * invoice.ticketPrice
      const vat = 0.19 * netAmount

      const countries = {
        de: 'Deutschland',
        ch: 'Schweiz',
        at: 'Österreich'
      }
      const currencyFormatter = new Intl.NumberFormat('de-DE', {style: 'currency', currency: 'EUR'})
      invoice.created = (new Date(invoice.created)).toLocaleDateString('de-DE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
      invoice.ticketType = invoice.ticketType === 'corporate' ? 'Unternehmen' : 'Privatperson / Einzelunternehmer'
      invoice.ticketString = 'Ticket' + (invoice.ticketCount === 1 ? '' : 's')
      invoice.bookedString = invoice.ticketCount === 1 ? 'das gebuchte' : 'die gebuchten'
      invoice.netAmount = currencyFormatter.format(netAmount)
      invoice.vat = currencyFormatter.format(vat)
      invoice.totalAmount = currencyFormatter.format(vat + netAmount)
      invoice.customer = invoice.customer[0]
      invoice.address = invoice.customer.addresses[0]
      invoice.address.country = countries[invoice.address.country]

      return Mustache.render('' + fs.readFileSync(__dirname + '/templates/invoice.html'), invoice)
    })
}
