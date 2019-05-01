'use strict'

const buttonCodes = {
  corporate: {live: 'YU36H9CWXCPAA', sandbox: '8LPMUVP9T6GKJ'},
  private: {live: '2A7U58XVNP73G', sandbox: 'XD3TZQ8PTDQVJ'},
  reduced: {live: 'XEJF3HM3C7CNW', sandbox: 'ANBYFPEREZ6AE'}
}

module.exports = (dgraphClient, dgraph, Invoice, fetch, baseUrl, mailSender, useSandbox, store) => {
  function paypalUrl() {
    return 'https://www.' + (useSandbox ? 'sandbox.' : '') + 'paypal.com/cgi-bin/webscr'
  }

  function encodeParams(params) {
    return Object.keys(params).map(key => key + '=' + encodeURIComponent(params[key])).join('&')
  }

  function exec(customer, invoice) {
    return paypalUrl() + '/payment?' + encodeParams({
      cmd: '_s-xclick',
      hosted_button_id: buttonCodes[invoice.ticketType][useSandbox ? 'sandbox' : 'live'],
      quantity: invoice.tickets.length,
      notify_url: baseUrl + 'paypal/ipn',
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
    })
  }

  async function paymentReceived(txn, invoice) {
    const customer = invoice.customer[0]
    const invoiceNo = invoice.invoiceNo || await Invoice.getNextInvoiceNo(txn)

    const mu = new dgraph.Mutation()
    await mu.setSetNquads(`
      <${invoice.uid}> <invoiceNo> "${invoiceNo}" .
      <${invoice.uid}> <paid> "1" .
      `)
    await txn.mutate(mu)

    store.add({type: 'payment-received', invoiceNo})

    mailSender.sendTicketNotifications(customer, invoice)
  }

  async function paypalIpn(req) {
    console.log('PayPal payment received', req.body)
    req.body.cmd = '_notify-validate'
    const options = {
      method: 'POST',
      headers: {'content-type': req.get('content-type')},
      body: encodeParams(req.body)
    }
    try {
      const content = await fetch(paypalUrl(), options)
      if (content !== 'VERIFIED') {
        mailSender.send('tech@justso.de', 'IPN not verified', JSON.stringify(req.body) + '\n\n' + content)
      } else {
        const txn = dgraphClient.newTxn()
        try {
          await paymentReceived(txn, await Invoice.get(txn, req.body.custom))
          txn.commit()
        } catch (error) {
          console.error(new Date(), error)
        } finally {
          txn.discard()
        }
      }
    } catch (error) {
      mailSender.send('tech@justso.de', 'Invalid IPN received from PayPal', JSON.stringify(error))
    }

    return ''
  }

  return {exec, paypalIpn, paymentReceived, useSandbox}
}
