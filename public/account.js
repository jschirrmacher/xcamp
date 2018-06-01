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
      .then(function (result) {
        if (result.rejected.length) {
          showMessage('Das Ticket konnte nicht versendet werden!\n\nBitte prüfe die Adresse und probiere es dann noch einmal.')
        } else {
          showMessage('Ticket wurde versendet')
        }
      })
  })

  function showMessage(msg) {
    var div = document.createElement('div')
    var span = document.createElement('div')
    span.innerText = msg
    div.className = 'alert'
    div.addEventListener('click', function () {
      div.remove()
    })
    div.appendChild(span)
    document.body.appendChild(div)
  }

  if (location.search.match(/message=([^&]*)/)) {
    showMessage(decodeURIComponent(RegExp.$1))
  }

  var pwd = document.getElementById('password')
  var pwd2 = document.getElementById('password-repeat')
  document.getElementById('chg-pwd-form').addEventListener('submit', function (event) {
    if (pwd.value !== pwd2.value) {
      event.preventDefault()
      showMessage('Passwörter stimmen nicht überein.')
      return false;
    }
  })
})()
