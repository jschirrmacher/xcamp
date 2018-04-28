(function() {
  'use strict'

  var form = document.getElementById('ticket-form')
  var ticketCount = document.getElementById('ticketCount')
  var tosAccepted = document.getElementById('tos-accepted')
  var submitButton = document.getElementById('submit-button')
  var mail2info = document.getElementsByClassName('mail2info')
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
    if (ticketCount.value !== '') {
      if (ticketCount.value < 1) {
        ticketCount.value = 1
      }
      var isCorporate = form.elements.type.value === 'corporate'
      var ticketPrice = isCorporate ? 238 : 119
      var totals = ticketCount.value * ticketPrice
      var ticket = ticketCount.value === 1 ? 'Ticket' : 'Tickets'
      invoiceDetails.innerText = ticketCount.value + ' ' + ticket + ' à ' + ticketPrice + '€ = ' + totals + '€ inkl. 19% MWSt.'
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

  form.addEventListener('submit', assertTOSAccepted)
  tosAccepted.addEventListener('change', setSubmitButtonState)
  ticketCount.addEventListener('change', adaptDependendFields)
  Array.prototype.forEach.call(form.elements.type, function (el) {
    el.addEventListener('change', adaptDependendFields)
  })
  adaptDependendFields()
  setSubmitButtonState()

  var info = 'info@justso.de'
  Array.prototype.forEach.call(mail2info, function (link) {
    link.setAttribute('href', 'mailto:' + info)
    link.innerText = info
  })
})()
