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
      var ticketPrice = 1.19 * categories[ticketType]
      var totals = ticketCount.value * ticketPrice
      singlePrice.innerText = ticketPrice.toFixed(2)
      invoiceDetails.innerText = 'Summe: ' + totals.toFixed(2) + '€ inkl. 19% MWSt.'
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
    privateTicket && (privateTicket.checked = true)
    firmField.style.display = 'none'
  }

  function isCorporate() {
    corporateTicket && (corporateTicket.checked = true)
    firmField.style.display = 'initial'
  }

  form.addEventListener('submit', assertTOSAccepted)
  tosAccepted.addEventListener('change', setSubmitButtonState)

  if (location.search.match(/type=private/) || location.search.match(/code=/)) {
    isPrivate()
  } else if (!location.search.match(/type=student/)) {
    isCorporate()
  }

  if (form.elements.type) {
    ticketCount.addEventListener('change', adaptDependendFields)
    privateTicket.addEventListener('change', isPrivate)
    corporateTicket.addEventListener('change', isCorporate)
    form.elements.type.forEach(function (el) {
      el.addEventListener('change', adaptDependendFields)
    })
    adaptDependendFields()
  }
  setSubmitButtonState()
})()
