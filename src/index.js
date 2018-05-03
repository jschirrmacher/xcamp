const fs = require('fs')
const path = require('path')
const Mustache = require('mustache')
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

const rack = require('hat').rack(128, 36)
const QueryFunction = require('./QueryFunction')
const Person = require('./person')(dgraphClient, dgraph)
const Customer = require('./customer')(dgraphClient, dgraph, QueryFunction, rack)
const Network = require('./network')(dgraphClient, dgraph)
const Invoice = require('./invoice')(dgraphClient, dgraph, rack)
const Ticket = require('./ticket')(dgraphClient, dgraph, Customer, Person, Invoice, require('./payment'), QueryFunction)

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

app.use('/', express.static(path.join(__dirname, '/../public')))
app.use('/js-netvis', express.static(path.join(__dirname, '/../node_modules/js-netvis/dist')))
app.use('/qrcode', express.static(path.join(__dirname, '/../node_modules/qrcode/build')))

app.post('/persons', (req, res) => exec(Person.create(req.body), res))
app.get('/persons/:id', (req, res) => exec(Person.get(req.params.id), res))

app.post('/tickets', (req, res) => exec(Ticket.buy(req.body, req.headers.origin), res))
app.put('/tickets/:ticketCode', (req, res) => exec(Ticket.setParticipant(req.params.ticketCode, req.body), res))
app.put('/tickets/:ticketCode/accounts/:customerCode', (req, res) => {
  exec(Ticket.setCustomerAsParticipant(req.params.ticketCode, req.params.customerCode), res)
})

app.post('/accounts', (req, res) => res.status(500).json({error: 'not yet implemented'}))   // register as community user without ticket
app.put('/accounts/:accessCode', (req, res) => res.status(500).json({error: 'not yet implemented'}))
app.get('/accounts/:accessCode/info', (req, res) => exec(getAccountInfoPage(req.params.accessCode), res, 'send'))
app.get('/accounts/:accessCode/invoices/current', (req, res) => exec(getLastInvoice(req.params.accessCode), res, 'send'))

app.get('/network', (req, res) => exec(Network.getGraph(), res))
app.delete('/network', (req, res) => exec(Network.rebuild(), res))

const port = 8001
app.listen(port, () => console.log('Running on port ' + port))

function getTemplate(name) {
  return '' + fs.readFileSync(path.join(__dirname, '/../templates/' + name + '.mustache'))
}

async function getAccountInfoPage(accessCode) {
  const txn = dgraphClient.newTxn()
  try {
    const customer = await Customer.findByAccessCode(txn, accessCode)
    const invoice = await Invoice.getNewest(txn, customer.id)
    const subTemplates = {
      ticketHeader: getTemplate('ticket-header'),
      ticketData: getTemplate('ticket-data'),
    }
    return Mustache.render(getTemplate('account-info'), {accessCode, tickets: invoice.tickets}, subTemplates)
  } finally {
    txn.discard()
  }
}

async function getLastInvoice(accessCode) {
  const txn = dgraphClient.newTxn()
  try {
    const customer = await Customer.findByAccessCode(txn, accessCode)
    const invoice = await Invoice.getNewest(txn, customer.id)
    return Invoice.getInvoiceAsHTML(invoice, getTemplate('invoice'))
  } finally {
    txn.discard()
  }
}
