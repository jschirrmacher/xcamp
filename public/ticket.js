(function() {
  'use strict'

  var form = document.getElementById('ticket-form')
  var privateTicket = document.getElementById('type-private')
  var corporateTicket = document.getElementById('type-corporate')
  var firmField = document.getElementById('payment-firm')
  var ticketCount = document.getElementById('ticketCount')
  var tosAccepted = document.getElementById('tos-accepted')
  var submitButton = document.getElementById('submit-button')
  var singlePrice = document.getElementById('single-price')
  var invoiceDetails = document.getElementById('invoice-details')
  var payPalPayment = document.getElementById('payment-paypal')
  var invoicePayment = document.getElementById('payment-invoice')

  function assertTOSAccepted() {
    return tosAccepted.checked
  }

  function toggleDisabled(el, state) {
    return state ? el.removeAttribute('disabled') : el.setAttribute('disabled', true)
  }

  function setSubmitButtonState() {
    toggleDisabled(submitButton, assertTOSAccepted())
  }

  function adaptDependendFields() {
    var ticketType = form.querySelector('input[name=type]:checked').value
    var isCorporate = ticketType === 'corporate'
    if (ticketCount.value !== '') {
      if (ticketCount.value < 1) {
        ticketCount.value = 1
      }
      var ticketPrice = isCorporate ? 238 : ticketType === 'private' ? 119 : 59.50
      var totals = (ticketCount.value * ticketPrice).toFixed(2)
      singlePrice.innerText = ticketPrice.toFixed(2)
      invoiceDetails.innerText = 'Summe: ' + totals + '€ inkl. 19% MWSt.'
    } else {
      invoiceDetails.innerText = 'Geben Sie bitte eine Ticketanzahl ein!'
    }

    invoicePayment.parentNode.classList.toggle('disabled', !isCorporate)
    if (isCorporate) {
      invoicePayment.removeAttribute('disabled')
    } else {
      invoicePayment.setAttribute('disabled', true)
      payPalPayment.checked = true
    }
  }

  function isPrivate() {
    firmField.style.display = 'none'
  }

  function isCorporate() {
    firmField.style.display = 'initial'
  }

  form.addEventListener('submit', assertTOSAccepted)
  tosAccepted.addEventListener('change', setSubmitButtonState)
  ticketCount.addEventListener('change', adaptDependendFields)
  privateTicket && privateTicket.addEventListener('change', isPrivate)
  corporateTicket && corporateTicket.addEventListener('change', isCorporate)
  Array.prototype.forEach.call(form.elements.type, function (el) {
    el.addEventListener('change', adaptDependendFields)
  })

  if (location.search.match(/type=private/) || location.search.match(/code=/)) {
    privateTicket && (privateTicket.checked = true)
    isPrivate()
  }

  if (location.search.match(/dev=true/)) {
    localStorage.setItem('isDev', true)
  }
  if (location.search.match(/dev=false/)) {
    localStorage.clear('isDev')
  }

  if (true || localStorage.getItem('isDev')) {
    document.getElementById('ticket-presale').style.display = 'none'
    document.getElementById('ticket-form').style.display = 'block'
  }
  adaptDependendFields()
  setSubmitButtonState()
})()
