(function() {
  'use strict'

  Array.prototype.forEach.call(document.getElementsByClassName('ticketNo'), function (el) {
    QRCode.toCanvas(el, location.origin + '/ticket/' + el.id)
  })

  Array.prototype.forEach.call(document.getElementsByClassName('mail2info'), function (link) {
    link.setAttribute('href', 'mailto:info@justso.de')
    link.innerText = 'info@justso.de'
  })

  Array.prototype.forEach.call(document.getElementsByClassName('useCustomer'), function (button) {
    button.addEventListener('click', function (event) {
      event.preventDefault()
      fetch('/tickets/' + button.form.id + '/accounts/' + location.pathname.split('/')[2], {method: 'PUT'})
        .then(function (response) {
          return response.ok ? location.reload() : Promise.reject(response.statusText)
        })
        .catch(function (error) {
          console.error(error)
        })
    })
  })
})()
