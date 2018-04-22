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

  function assertTOSAccepted() {
    return tosAccepted.checked
  }

  function setSubmitButtonState() {
    if (assertTOSAccepted()) {
      submitButton.removeAttribute('disabled')
    } else {
      submitButton.setAttribute('disabled', true)
    }
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
        updateInvoiceDetails()
        return false
      })
    })
    addTicket.parentNode.insertBefore(newElems, addTicket)
    updateInvoiceDetails()
    return false
  }

  function updateInvoiceDetails() {
    var numTickets = document.getElementsByClassName('participant').length + (buyForOthers.checked ? 0 : 1)
    var ticketPrice = form.elements.type.value === 'corporate' ? 238 : 119
    var totals = numTickets * ticketPrice
    invoiceDetails.innerText = numTickets + ' Tickets à ' + ticketPrice + '€ = ' + totals + '€'
  }

  form.addEventListener('submit', assertTOSAccepted)
  addTicket.addEventListener('click', handleAddTicket)
  buyForOthers.addEventListener('click', handleBuyForOthers)
  tosAccepted.addEventListener('change', setSubmitButtonState)
  Array.prototype.forEach.call(form.elements.type, function (el) {
    el.addEventListener('change', updateInvoiceDetails)
  })
  updateInvoiceDetails()
  setSubmitButtonState()

  var info = 'info@justso.de'
  Array.prototype.forEach.call(mail2info, function (link) {
    link.setAttribute('href', 'mailto:' + info)
    link.innerText = info
  })
})()
