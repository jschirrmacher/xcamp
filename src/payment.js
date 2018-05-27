'use strict'

const mailSender = require('./mailSender')

module.exports = (baseUrl, useSandbox) => {
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

  function paypalIpn(req) {
    console.log(req.body)
    req.body.cmd = '_notify-validate'
    const options = {
      method: 'POST',
      headers: {'content-type': req.headers.get('content-type')},
      body: encodeParams(req.body)
    }
    fetch(paypalUrl(), options)
      .then(data => ({data, content: data.headers.get('content-type').match(/json/) ? data.json() : data.text()}))
      .then(res => res.ok ? content : Promise.reject({message: 'Invalid IPN received from PayPal', details: data.content}))
      .then(content => content === 'VERIFIED' || Promise.reject({message: 'IPN not verified', detail: content}))
      .then(data => {
        console.log(data) // TODO set state of invoice to 'paid'
      })
      .catch(error => mailSender.send('tech@justso.de', error.message, '<pre>' + error.details + '</pre>'))
    return ''
  }

  return {exec, paypalIpn, useSandbox}
}
