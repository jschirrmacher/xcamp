module.exports = baseUrl => ({
  exec: (buyer, reduced, amount, useSandbox) => {
    let hosted_button_id
    if (reduced) {
      hosted_button_id = useSandbox ? '2A7U58XVNP73G' : '2A7U58XVNP73G'
    } else {
      hosted_button_id = useSandbox ? 'YU36H9CWXCPAA' : 'YU36H9CWXCPAA'
    }
    const params = {
      cmd: '_s-xclick',
      hosted_button_id,
      amount: amount * 1.19,
      notify_url: baseUrl + '/payment-result',
      no_shipping: 0,
      address1: buyer.address,
      city: buyer.city,
      country: buyer.country,
      email: buyer.email,
      first_name: buyer.firstName,
      last_name: buyer.lastName,
      lc: 'de',
      zip: buyer.postcode,
      custom: buyer.id
    }

    const prefix = useSandbox ? '' : 'sandbox.'
    const paramString = Object.keys(params).map(key => key + '=' + encodeURIComponent(params[key])).join('&')
    return 'https://www.' + prefix + 'paypal.com/cgi-bin/webscr/payment?' + paramString
  }
})
