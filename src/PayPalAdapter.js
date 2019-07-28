'use strict'

module.exports = (fetch, store, config) => {
  function paypalUrl() {
    return 'https://www.' + (config.isProduction ? '' : 'sandbox.') + 'paypal.com/cgi-bin/webscr'
  }

  function encodeParams(params) {
    return Object.keys(params).map(key => key + '=' + encodeURIComponent(params[key])).join('&')
  }

  function getPaymentURL(customer, invoice) {
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

  async function paypalIpn(req) {
    store.add({type: 'paypal-payment-received', info: req.body})
    req.body.cmd = '_notify-validate'
    const options = {
      method: 'POST',
      headers: {'content-type': req.get('content-type')},
      body: encodeParams(req.body)
    }
    try {
      const content = await fetch(paypalUrl(), options)
      if (content !== 'VERIFIED') {
        store.add({type: 'paypal-payment-error', subject: 'IPN not verified', info: content})
      } else {
        store.add({type: 'payment-received', invoiceId: req.body.custom})
      }
    } catch (error) {
      store.add({type: 'paypal-payment-error', subject: 'Error while handling PayPal payment', info: error})
    }

    return ''
  }

  return {getPaymentURL, paypalIpn}
}
