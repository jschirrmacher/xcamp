(function () {
  'use strict'

  const token = document.cookie.match(new RegExp('(^| )token=([^;]+)'))
  const authorization = token ? token[2] : null

  forEachElementOfClass('ticketNo', function (el) {
    QRCode.toCanvas(el, document.head.baseURI + '/ticket/' + el.id)
  })

  forEachElementOfClass('mail2info', function (link) {
    link.setAttribute('href', 'mailto:info@justso.de')
    link.innerText = 'info@justso.de'
  })

  bindHandler('useCustomer', 'click', function (button) {
    fetchReload('tickets/' + button.form.id + '/accounts/' + document.body.dataset.code, {method: 'PUT', headers: {authorization}})
  })

  bindHandler('saveTicket', 'click', function (button) {
    const options = encodeParams({
      firstName: button.form.elements['participant_firstName'].value,
      lastName: button.form.elements['participant_lastName'].value,
      email: button.form.elements['participant_email'].value,
    }, {method: 'PUT', headers: {authorization, 'content-type': 'application/x-www-form-urlencoded'}})
    fetchReload('tickets/' + button.form.id, options)
  })

  bindHandler('printTicket', 'click', function (button) {
    window.open('tickets/' + button.form.id + '/print')
  })

  bindHandler('sendTicket', 'click', function (button) {
    myFetch('tickets/' + button.form.id + '/send', {headers: {authorization}})
      .then(function (result) {
        if (result.error || result.rejected.length) {
          showMessage('Das Ticket konnte nicht versendet werden!\n\nBitte prüfe die Adresse und probiere es dann noch einmal.')
        } else {
          showMessage('Ticket wurde versendet')
        }
      })
  })

  Array.from(document.getElementsByTagName('input')).forEach(function (field) {
    field.addEventListener('keyup', function () {
      field.form.modified = false
      Array.from(field.form.elements).forEach(function (input) {
        if (input.name && input.value !== input.getAttribute('value')) {
          field.form.modified = true
        }
      })
      Array.from(field.form.getElementsByClassName('saveTicket')).forEach(function (button) {
        button.style.display = field.form.modified ? 'inline' : 'none'
      })
      Array.from(field.form.getElementsByClassName('sendTicket')).forEach(function (button) {
        button.style.display = !field.form.modified && field.form.elements['participant_email'].getAttribute('value') ? 'inline' : 'none'
      })
    })
  })

  Array.from(document.getElementsByClassName('sendTicket')).forEach(function (button) {
    if (button.form.elements['participant_email'].getAttribute('value')) {
      button.style.display = 'inline'
    }
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
    window.history.replaceState(null, null, location.pathname)
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
