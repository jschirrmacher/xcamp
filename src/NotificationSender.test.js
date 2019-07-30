require('should')

const config = {
  'mail-recipients': {
    admin: 'admin@example.com'
  }
}

const storedEvents = []
const store = {
  add(event) {
    storedEvents.push(event)
  }
}

const invoices = {
  7: {id: 7, payment: 'invoice', customer: {id: 99}},
  8: {id: 8, payment: 'invoice', customer: {id: 88}, invoiceNo: 41}
}

const readModels = {
  invoice: {
    getById(id) {
      return invoices[id]
    },

    getMaxInvoiceNo() {
      return 41
    }
  }
}

const sentMails = []
const mailSender = {
  send(receiver, subject, body) {
    sentMails.push({receiver, subject, body})
  },
  sendTicketNotifications(customer, invoice) {
    sentMails.push({customer, invoice})
  }
}

const sender = require('./NotificationSender')({mailSender, store, readModels, config})

const assert = () => {}

describe('NotificationSender', () => {
  it('should send a notification after buying a corporate ticket which is paid by invoice', () => {
    sentMails.length = 0
    sender.handleEvent({type: 'invoice-created', invoice: {id: 7}}, assert, 'new')
    sentMails.should.deepEqual([{customer: {id: 99}, invoice: invoices[7]}])
  })

  it('should not send another notification when invoice is paid', () => {
    sentMails.length = 0
    sender.handleEvent({type: 'payment-received', invoiceId: 8}, assert, 'new')
    sentMails.should.deepEqual([])
  })

  it('should notify admin if payment fails', () => {
    sentMails.length = 0
    const subject = 'Test error'
    const event = {type: 'paypal-payment-error', subject}
    sender.handleEvent(event, assert, 'new')
    sentMails.should.deepEqual([{receiver: 'admin@example.com', subject, body: JSON.stringify(event, null, 2)}])
  })
})
