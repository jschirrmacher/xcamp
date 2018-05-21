(function () {
  'use strict'

  forEachElementOfClass('ticketNo', function (el) {
    QRCode.toCanvas(el, location.origin + '/ticket/' + el.id)
  })

  forEachElementOfClass('mail2info', function (link) {
    link.setAttribute('href', 'mailto:info@justso.de')
    link.innerText = 'info@justso.de'
  })

  bindHandler('useCustomer', 'click', function (button) {
    fetchReload('/netvis/tickets/' + button.form.id + '/accounts/' + location.pathname.split('/')[3], {method: 'PUT'})
  })

  bindHandler('saveTicket', 'click', function (button) {
    const options = encodeParams({
      firstName: button.form.elements['participant_firstName'].value,
      lastName: button.form.elements['participant_lastName'].value,
      email: button.form.elements['participant_email'].value,
    }, {method: 'PUT'})
    fetchReload('/netvis/tickets/' + button.form.id, options)
  })

  bindHandler('printTicket', 'click', function (button) {
    window.open('/netvis/tickets/' + button.form.id + '/print')
  })

  bindHandler('sendTicket', 'click', function (button) {
    myFetch('/netvis/tickets/' + button.form.id + '/send')
  })
})()
