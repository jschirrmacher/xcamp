module.exports = (dependencies) => {
  const {
    express,
    auth,
    doInTransaction,
    makeHandler,
    templateGenerator,
    sendHashMail,
    Customer,
    Invoice,
    Ticket,
    Network,
    store,
    baseUrl,
    dgraph
  } = dependencies

  async function checkinApp() {
    return templateGenerator.generate('checkinApp')
  }

  async function createOrgaMember(txn, data) {
    data.payment = 'none'
    const customer = await Customer.create(txn, data)
    const tickets = await Ticket.create(txn, customer.person[0], data.ticketCount || 1)
    await Invoice.create(txn, data, customer, tickets)
    const hash = sendHashMail(txn, 'send-free-ticket-mail', customer,'accounts/' + customer.access_code + '/password/reset')
    store.add({type: 'set-mail-hash', userId: customer.uid, hash})
  }

  async function createCoupon(txn) {
    const mu = new dgraph.Mutation()
    const access_code = rack()
    mu.setSetJson({type: 'coupon', access_code})
    const assigned = await txn.mutate(mu)
    store.add({type: 'coupon-created', access_code})
    return {type: 'coupon', uid: assigned.getUidsMap().get('blank-0'), link: baseUrl + 'tickets?code=' + access_code}
  }

  async function listInvoices(txn) {
    let participantCount = 0
    let paidTickets = 0
    let totals = 0
    const paymentType = {
      paypal: 'PayPal',
      invoice: 'Rechnung',
      none: 'N/A'
    }
    const invoices = await Invoice.listAll(txn)
    invoices.forEach(invoice => {
      if (!invoice.customer) {
        throw 'No customer defined for invoice: ' + JSON.stringify(invoice)
      }
      if (!invoice.customer[0].person) {
        throw 'No person defined for customer: ' + JSON.stringify(invoice)
      }
      invoice.customer = invoice.customer[0]
      invoice.customer.person = invoice.customer.person[0]
      invoice.created = Invoice.getFormattedDate(new Date(invoice.created))
      invoice.payment = invoice.paid ? paymentType[invoice.payment] : 'Offen'
      invoice.participants = invoice.tickets.filter(ticket => ticket.participant).map(ticket => {
        const participant = ticket.participant[0]
        participant.checkedIn = ticket.checkedIn ? 'checked' : ''
        return participant
      })
      participantCount += invoice.tickets.length
      if (invoice.paid) {
        paidTickets += invoice.tickets.length
        totals += invoice.tickets.length * invoice.ticketPrice
      }
      invoice.paid = invoice.paid ? 'paid' : 'open'
    })
    return templateGenerator.generate('invoices-list', {
      invoices,
      participantCount,
      paidTickets,
      totals
    })
  }

  async function invoicePayment(txn, invoiceId, state) {
    const invoice = await Invoice.get(txn, invoiceId)
    if (state && invoice.payment === 'paypal') {
      await Payment.paymentReceived(txn, invoice)
    } else {
      const mu = new dgraph.Mutation()
      if (state) {
        mu.setSetNquads(`<${invoiceId}> <paid> "1" .`)
      } else {
        mu.setDelNquads(`<${invoiceId}> <paid> * .`)
      }
      await txn.mutate(mu)
    }
  }

  async function generateTile(data) {
    const colorSelect = () => value => {
      const flags = {};
      ['yellow', 'turquoise', 'red', 'grey', 'tuatara'].forEach(color => {
        flags['is_' + color] = color === data[value] ? 'selected' : ''
      })
      return templateGenerator.generate('colorOptions', flags)
    }
    return templateGenerator.generate('tile-form', {colorSelect, ...data})
  }

  async function exportParticipants(txn, format) {
    const tickets = await Network.getAllTickets(txn)
    const content = tickets.map(ticket => {
      const person = ticket.participant[0]
      if (format === 'excel') {
        return `"${person.firstName}";"${person.lastName}";"${person.email}";"${ticket.firm}"`
      } else if (format === 'csv') {
        return `"${person.firstName}","${person.lastName}","${person.email}","${ticket.firm}"`
      } else {
        return person.firstName + ' ' + person.lastName + ' &lt;' + person.email + '&gt; ' + ticket.firm
      }
    }).join('\n')

    if (format === 'csv' || format === 'excel') {
      return {
        mimeType: 'application/x-ms-excel',
        disposition: 'attachment',
        name: 'participants.csv',
        content
      }
    } else {
      return content.replace(/\n/g, '<br>\n')
    }
  }

  const router = express.Router()
  const redirect = true
  const allowAnonymous = true

  router.post('/', auth.requireJWT({allowAnonymous}), auth.requireAdmin(), makeHandler(req => doInTransaction(createOrgaMember, [req.body], true)))
  router.post('/coupon', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => doInTransaction(createCoupon, [], true)))
  router.get('/participants', auth.requireJWT({redirect}), auth.requireAdmin(), makeHandler(req => doInTransaction(exportParticipants, req.query.format || 'txt'), 'send'))
  router.get('/invoices', auth.requireJWT({redirect}), auth.requireAdmin(), makeHandler(req => doInTransaction(listInvoices), 'send'))
  router.put('/invoices/:invoiceNo/paid', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => doInTransaction(invoicePayment, [req.params.invoiceNo, true], true)))
  router.delete('/invoices/:invoiceNo/paid', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => doInTransaction(invoicePayment, [req.params.invoiceNo, false], true)))
  router.delete('/invoices/:invoiceNo', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => doInTransaction(Invoice.deleteInvoice, [req.params.invoiceNo, true], true)))
  router.get('/checkin', auth.requireJWT({redirect}), auth.requireAdmin(), makeHandler(req => checkinApp(), 'send'))
  router.get('/tiles', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => generateTile(req.query), 'send'))

  return router
}
