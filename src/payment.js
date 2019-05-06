'use strict'

module.exports = (dgraphClient, dgraph, Model, fetch, mailSender, store, config) => {
  function paypalUrl() {
    return 'https://www.' + (config.isProduction ? '' : 'sandbox.') + 'paypal.com/cgi-bin/webscr'
  }

  function encodeParams(params) {
    return Object.keys(params).map(key => key + '=' + encodeURIComponent(params[key])).join('&')
  }

  function exec(customer, invoice) {
    return paypalUrl() + '/payment?' + encodeParams({
      cmd: '_s-xclick',
      hosted_button_id: config.paypal.buttons[invoice.ticketType],
      quantity: invoice.tickets.length,
      notify_url: config.baseUrl + 'paypal/ipn',
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
    const invoiceNo = invoice.invoiceNo || await Model.Invoice.getNextInvoiceNo(txn)

    const mu = new dgraph.Mutation()
    await mu.setSetNquads(`
      <${invoice.uid}> <invoiceNo> "${invoiceNo}" .
      <${invoice.uid}> <paid> "1" .
      `)
    await txn.mutate(mu)

    if (!invoice.invoiceNo) {
      store.add({type: 'invoice-updated', invoice: {id: invoice.uid, invoiceNo}})
      invoice.invoiceNo = invoiceNo
    }
    store.add({type: 'payment-received', invoiceId: invoice.uid})

    mailSender.sendTicketNotifications(customer, invoice)
  }

  async function paypalIpn(req) {
    const admin = config['mail-recipients'].admin
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
        mailSender.send(admin, 'IPN not verified', JSON.stringify(req.body) + '\n\n' + content)
      } else {
        const txn = dgraphClient.newTxn()
        try {
          await paymentReceived(txn, await Model.Invoice.get(txn, req.body.custom))
          txn.commit()
        } catch (error) {
          console.error(new Date(), error)
        } finally {
          txn.discard()
        }
      }
    } catch (error) {
      mailSender.send(admin, 'Invalid IPN received from PayPal', JSON.stringify(error))
    }

    return ''
  }

  return {exec, paypalIpn, paymentReceived}
}
