(function() {
  'use strict'

  var form = document.getElementById('ticket-form')
  var addTicket = document.getElementById('additional-ticket')
  var buyForOthers = document.getElementById('buy-for-other')
  var participantData = document.getElementById('participantData').innerHTML
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

  function handleBuyForOthers() {
    if (!document.getElementsByClassName('participant').length) {
      handleAddTicket()
    }
  }

  function handleAddTicket() {
    var newElems = document.createElement('div')
    newElems.className = 'participant'
    newElems.innerHTML = participantData
    Array.prototype.forEach.call(newElems.getElementsByClassName('delete'), function (delLink) {
      delLink.addEventListener('click', function () {
        newElems.remove()
        adaptDependendFields()
        return false
      })
    })
    addTicket.parentNode.insertBefore(newElems, addTicket)
    adaptDependendFields()
    return false
  }

  function adaptDependendFields() {
    var numTickets = document.getElementsByClassName('participant').length + (buyForOthers.checked ? 0 : 1)
    var isCorporate = form.elements.type.value === 'corporate'
    var ticketPrice = isCorporate ? 238 : 119
    var totals = numTickets * ticketPrice
    var ticket = numTickets === 1 ? 'Ticket' : 'Tickets'
    invoiceDetails.innerText = numTickets + ' ' + ticket + ' à ' + ticketPrice + '€ = ' + totals + '€ inkl. 19% MWSt.'

    invoicePayment.parentNode.classList.toggle('disabled', !isCorporate)
    if (isCorporate) {
      invoicePayment.removeAttribute('disabled')
    } else {
      invoicePayment.setAttribute('disabled', true)
      payPalPayment.checked = true
    }
  }

  form.addEventListener('submit', assertTOSAccepted)
  addTicket.addEventListener('click', handleAddTicket)
  buyForOthers.addEventListener('click', handleBuyForOthers)
  tosAccepted.addEventListener('change', setSubmitButtonState)
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
