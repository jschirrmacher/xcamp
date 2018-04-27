module.exports = (dgraphClient, fs, customer, person, payment, invoicesFilesBase) => {
  const metaFile = invoicesFilesBase + 'meta.json'

  function getNextId() {
    const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile).toString()) : {invoiceId: 0}
    meta.invoiceId++
    fs.writeFileSync(metaFile, JSON.stringify(meta))
    return meta.invoiceId
  }

  function buy(data, origin) {
    if (!data.tos_accepted) {
      return Promise.reject({status: 403, message: 'You need to accept the terms of service'})
    } else {
      return customer.create(data)
        .then(customer => {
          const ticketType = data.type === 'corporate' ? 'Unternehmen' : 'Privatperson / Einzelunternehmer'
          const ticketPrice = data.type === 'corporate' ? 200 : 100
          const payByInvoice = data.payment === 'invoice' && !data.reduced
          const numTickets = (!data.buy_for_other ? 0 : 1) + (data.participant_email && data.participant_email.length || 1)
          const totals = numTickets * ticketPrice
          const id = getNextId()
          const created = '' + new Date()
          const invoice = {
            id,
            created,
            customer,
            numTickets,
            ticketType,
            ticketPrice,
            payment: data.payment,
            reduced: data.reduced
          }
          const invoiceFile = invoicesFilesBase + 'XCamp-' + customer.id + '-' + invoice.id + '.json'
          fs.writeFileSync(invoiceFile, JSON.stringify(invoice))
          const invoiceInfoUrl = origin + '/accaunts/' + customer.access_code
          const url = payByInvoice ? invoiceInfoUrl : payment(origin).exec(customer, data.reduced, totals, true)
          return {isRedirection: true, url}
        })
    }
  }

  return {buy}
}
