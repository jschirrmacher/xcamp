module.exports = baseUrl => ({
  exec: (customer, invoice, useSandbox) => {
    let hosted_button_id
    if (invoice.reduced) {
      hosted_button_id = useSandbox ? '2A7U58XVNP73G' : '2A7U58XVNP73G'
    } else {
      hosted_button_id = useSandbox ? 'YU36H9CWXCPAA' : 'YU36H9CWXCPAA'
    }
    const params = {
      cmd: '_s-xclick',
      hosted_button_id,
      amount: (invoice.ticketCount * invoice.ticketPrice) * 1.19,
      notify_url: baseUrl + '/payment-result',
      no_shipping: 0,
      first_name: customer.firstName,
      last_name: customer.lastName,
      address1: customer.address,
      zip: customer.postcode,
      city: customer.city,
      country: customer.country,
      email: customer.email,
      lc: 'de',
      custom: customer.id
    }

    const prefix = useSandbox ? '' : 'sandbox.'
    const paramString = Object.keys(params).map(key => key + '=' + encodeURIComponent(params[key])).join('&')
    return 'https://www.' + prefix + 'paypal.com/cgi-bin/webscr/payment?' + paramString
  }
})
