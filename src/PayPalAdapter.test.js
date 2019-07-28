require('should')

const events = []
const store = {
  add(event) {
    events.push(event)
  }
}

const config = {
  baseUrl: 'http://test.local/',
  paypal: {
    buttons: {
      'test-ticket': 'test id'
    }
  },
  'mail-recipients': {
    admin: 'admin@example.com'
  }
}

function fetch(url, options) {
  if (url === 'https://www.sandbox.paypal.com/cgi-bin/webscr') {
    if (options.headers['content-type'] === 'ok') {
      return Promise.resolve('VERIFIED')
    } else if (options.headers['content-type'] === 'fetch-fail') {
      return Promise.reject('fetch failed')
    } else {
      return Promise.resolve('FAIL')
    }
  } else {
    return Promise.reject('Unknown URL called')
  }
}

const payment = require('./PayPalAdapter')(fetch, store, config)

describe('PayPalAdapter', () => {
  it('should use the sandbox if not in production mode', () => {
    config.isProduction = false
    payment.getPaymentURL({}, {tickets: [{}]}).should.startWith('https://www.sandbox.')
  })

  it('should use configured baseUrl', () => {
    const notifyUrl = encodeURIComponent('http://test.local/paypal/ipn')
    payment.getPaymentURL({}, {tickets: [{}]}).should.containEql(`&notify_url=${notifyUrl}&`)
  })

  it('should use configured button ids', () => {
    const invoice = {ticketType: 'test-ticket', tickets: [{}]}
    payment.getPaymentURL({}, invoice).should.containEql('&hosted_button_id=test%20id&')
  })

  it('should handle IPN calls', async () => {
    (await payment.paypalIpn({body: {}, get: () => 'ok'})).should.equal('')
  })

  it('should log IPN as an event', async () => {
    events.length = 0
    await payment.paypalIpn({body: {}, get: () => 'ok'})
    events[0].type.should.equal('paypal-payment-received')
  })

  it('should send an event with the invoice id when ok', async () => {
    events.length = 0
    await payment.paypalIpn({body: {custom: 4711}, get: () => 'ok'})
    events[1].should.deepEqual({type: 'payment-received', invoiceId: 4711})
  })

  it('should send an error event when PayPal returns an error', async () => {
    events.length = 0
    await payment.paypalIpn({body: {}, get: () => 'fail'})
    events[1].should.deepEqual({type: 'paypal-payment-error', subject: 'IPN not verified', info: 'FAIL'})
  })

  it('should send an error event when fetch fails', async () => {
    events.length = 0
    await payment.paypalIpn({body: {}, get: () => 'fail-fetch'})
    events[1].should.deepEqual({type: 'paypal-payment-error', subject: 'IPN not verified', info: 'FAIL'})
  })
})
