(function () {
  'use strict'

  var token = document.cookie.match(new RegExp('(^| )token=([^;]+)'))
  var authorization = token ? token[2] : null

  select('.ticketNo').forEach(function (el) {
    QRCode.toCanvas(el, document.head.baseURI + '/ticket/' + el.id)
  })

  document.querySelectorAll('.mail2info').forEach(function(link) {
    var subject = encodeURIComponent('Bitte aus dem XCamp-Netzwerk entfernen')
    link.setAttribute('href', 'mailto:netvis@xcamp.co?subject=' + subject)
    link.innerText = 'netvis@xcamp.co'
  })

  select('.saveTicket').addEventListener('click', function (event) {
    var button = event.target
    var options = encodeParams({
      firstName: button.form.elements['participant_firstName'].value,
      lastName: button.form.elements['participant_lastName'].value,
      email: button.form.elements['participant_email'].value,
    }, {method: 'PUT', headers: {authorization, 'content-type': 'application/x-www-form-urlencoded'}})
    fetchReload('tickets/' + button.form.id, options)
  })

  select('.printTicket').addEventListener('click', function (event) {
    window.open('tickets/' + event.target.form.id + '/print')
  })

  select('input').forEach(function (field) {
    field.addEventListener('keyup', function () {
      field.form.modified = false
      Array.from(field.form.elements).forEach(function (input) {
        if (input.name && input.value !== input.getAttribute('value')) {
          field.form.modified = true
        }
      })
      field.form.getElementsByClassName('saveTicket')[0].style.display = field.form.modified ? 'inline' : 'none'
    })
  })

  if (location.search.match(/message=([^&]*)/)) {
    showMessage(decodeURIComponent(RegExp.$1))
    window.history.replaceState(null, null, location.pathname)
  }
})()
