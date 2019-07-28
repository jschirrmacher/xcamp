module.exports = function ({mailSender, readModels, config}) {
  function sendTicket(invoiceId) {
    const invoice = readModels.invoice.getById(invoiceId)
    mailSender.sendTicketNotifications(invoice.customer, invoice)
  }

  return {
    handleEvent(event, assert, type) {
      if (type === 'new') {
        switch (event.type) {
          case 'talk-published':
            mailSender.send(
              config['mail-recipients'].talkInfoReceiver,
              'Talk veröffentlicht',
              `<p>${event.person.name} hat seinen/ihren Talk veröffentlicht</p>\n<p>\n${event.talk}</p>`
            )
            break

          case 'talk-withdrawn':
            mailSender.send(
              config['mail-recipients'].talkInfoReceiver,
              'Talk zurückgezogen',
              `${event.person.name} hat seinen/ihren Talk zurückgezogen`
            )
            break

          case 'invoice-created':
            if (readModels.invoice.getById(event.invoiceId).payment === 'invoice') {
              sendTicket(event.invoiceId)
            }
            break

          case 'payment-received':
            if (!readModels.invoice.getById(event.invoiceId).invoiceNo) {
              sendTicket(event.invoiceId)
            }
            break

          case 'paypal-payment-error':
            mailSender.send(config['mail-recipients'].admin, event.subject, JSON.stringify(event, null, 2))
            break
        }
      }
    }
  }
}
