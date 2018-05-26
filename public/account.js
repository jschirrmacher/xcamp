(function () {
  'use strict'

  forEachElementOfClass('ticketNo', function (el) {
    QRCode.toCanvas(el, document.head.baseURI + '/ticket/' + el.id)
  })

  forEachElementOfClass('mail2info', function (link) {
    link.setAttribute('href', 'mailto:info@justso.de')
    link.innerText = 'info@justso.de'
  })

  bindHandler('useCustomer', 'click', function (button) {
    fetchReload('tickets/' + button.form.id + '/accounts/' + document.body.dataset.code, {method: 'PUT'})
  })

  bindHandler('saveTicket', 'click', function (button) {
    const options = encodeParams({
      firstName: button.form.elements['participant_firstName'].value,
      lastName: button.form.elements['participant_lastName'].value,
      email: button.form.elements['participant_email'].value,
    }, {method: 'PUT'})
    fetchReload('tickets/' + button.form.id, options)
  })

  bindHandler('printTicket', 'click', function (button) {
    window.open('tickets/' + button.form.id + '/print')
  })

  bindHandler('sendTicket', 'click', function (button) {
    myFetch('tickets/' + button.form.id + '/send')
  })
})()
