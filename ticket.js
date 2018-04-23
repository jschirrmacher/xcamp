module.exports = (dgraphClient, person, payment) => {
  function createBuyer(data) {
    return person.create(data)
  }

  function getNetTotals(data) {
    const ticketPrice = data.type === 'corporate' ? 200 : 100
    const numTickets = (!data.buy_for_other ? 0 : 1) + (data.participant_email && data.participant_email.length || 1)
    return numTickets * ticketPrice
  }

  function buy(data) {
    if (!req.body.tos_accepted) {
      return Promise.reject({status: 403, message: 'You need to accept the terms of service'})
    } else {
      return createBuyer(data)
        .then(buyer => {
          const origin = req.headers.origin
          const payPerInvoice = data.payment === 'invoice' && !data.reduced
          const totals = getNetTotals(data)
          const invoiceInfoUrl = origin + '/invoice-info.html'
          const url = payPerInvoice ? invoiceInfoUrl : payment(origin).exec(buyer, data.reduced, totals, true)
          return Promise.reject({status: 302, url})
        })
    }
  }

  return {buy}
}
