'use strict'

const mailSender = require('./mailSender')

module.exports = (dgraphClient, dgraph, Invoice, fetch, baseUrl, mailSender, useSandbox) => {
  function paypalUrl() {
    return 'https://www.' + (useSandbox ? 'sandbox.' : '') + 'paypal.com/cgi-bin/webscr'
  }

  function encodeParams(params) {
    return Object.keys(params).map(key => key + '=' + encodeURIComponent(params[key])).join('&')
  }

  function exec(customer, invoice) {
    let hosted_button_id
    if (invoice.reduced) {
      hosted_button_id = useSandbox ? 'XD3TZQ8PTDQVJ' : '2A7U58XVNP73G'
    } else {
      hosted_button_id = useSandbox ? '8LPMUVP9T6GKJ' : 'YU36H9CWXCPAA'
    }
    const params = {
      cmd: '_s-xclick',
      hosted_button_id,
      amount: (invoice.ticketCount * invoice.ticketPrice) * 1.19,
      notify_url: baseUrl + '/paypal/ipn',
      no_shipping: 0,
      first_name: customer.firstName,
      last_name: customer.lastName,
      address1: customer.address,
      zip: customer.postcode,
      city: customer.city,
      country: customer.country,
      email: customer.email,
      lc: 'de',
      custom: invoice.uid
    }

    return paypalUrl() + '/payment?' + encodeParams(params)
  }

  async function paymentReceived(invoiceId) {
    const txn = dgraphClient.newTxn()
    try {
      const invoice = await Invoice.get(txn, invoiceId)
      const customer = invoice.customer[0]

      const mu = new dgraph.Mutation()
      await mu.setSetNquads(`<${invoiceId}> <paid> 1 .`)
      await txn.mutate(mu)

      txn.commit()
      mailSender.sendTicketNotifications(customer, invoice)
    } catch (error) {
      console.error(error)
    } finally {
      txn.discard()
    }
  }

  async function paypalIpn(req) {
    req.body.cmd = '_notify-validate'
    const options = {
      method: 'POST',
      headers: {'content-type': req.get('content-type')},
      body: encodeParams(req.body)
    }
    try {
      const content = await fetch(paypalUrl(), options)
      if (content !== 'VERIFIED') {
        mailSender.send('tech@justso.de', 'IPN not verified', JSON.stringify(req.body))
      } else {
        paymentReceived(req.body.custom)
      }
    } catch (error) {
      mailSender.send('tech@justso.de', 'Invalid IPN received from PayPal', JSON.stringify(error))
    }

    return ''
  }

  return {exec, paypalIpn, useSandbox}
}
