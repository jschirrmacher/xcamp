const stream = require('stream')

const toRemove = [
  {ts: '2019-04-25T07:39:19.196Z', type: 'person-topic-linked', personId: '0x186bd'},
  {ts: '2019-05-05T14:04:27.553Z', type: 'person-topic-linked', personId: '0x186bd', topicid: '0x249f1'}
]

let lastInvoiceId

module.exports = class From_8 extends stream.Transform {
  constructor(options = {}) {
    options.objectMode = true
    super(options)
  }

  _transform(event, encoding, callback) {
    const onBlackList = toRemove.some(r => JSON.stringify(r) === JSON.stringify(event))
    const isWrongDeletion = event.type === 'person-updated' && event.person.email === ''
    const isInvalidated = event.type === 'person-updated' && event.person.email && event.person.email.match(/^invalidated/)

    if (!onBlackList && !isWrongDeletion && !isInvalidated) {
      if (event.type === 'invoice-created') {
        lastInvoiceId = event.invoice.id
      } else if (event.type === 'invoice-updated' && !event.invoice.id) {
        event.invoice.id = lastInvoiceId
      } else if (event.type === 'payment-received' && !event.invoiceId) {
        event.invoiceId = lastInvoiceId
      }

      this.push(event)
    }
    callback()
  }
}
