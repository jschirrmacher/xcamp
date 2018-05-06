(function () {
  'use strict'

  forEachElementOfClass('ticketNo', function (el) {
    QRCode.toCanvas(el, location.origin + '/ticket/' + el.id)
  })

  forEachElementOfClass('mail2info', function (link) {
    link.setAttribute('href', 'mailto:info@justso.de')
    link.innerText = 'info@justso.de'
  })

  forEachElementOfClass('useCustomer', function (button) {
    button.addEventListener('click', function (event) {
      event.preventDefault()
      fetchReload('/tickets/' + button.form.id + '/accounts/' + location.pathname.split('/')[2], {method: 'PUT'})
    })
  })

  forEachElementOfClass('saveTicket', function (button) {
    button.addEventListener('click', function (event) {
      event.preventDefault()
      const options = encodeParams({
        firstName: button.form.elements['participant_firstName'].value,
        lastName: button.form.elements['participant_lastName'].value,
        email: button.form.elements['participant_email'].value,
      }, {method: 'PUT'})
      fetchReload('/tickets/' + button.form.id, options)
    })
  })

  function forEachElementOfClass(className, callback) {
    Array.prototype.forEach.call(document.getElementsByClassName(className), callback)
  }

  function encodeParams(params, otherOptions) {
    const body = Object.keys(params).map(function (key) {
      return key + '=' + encodeURIComponent(params[key])
    }).join('&')
    return Object.assign({body, headers: {'Content-Type': 'application/x-www-form-urlencoded'}}, otherOptions)
  }

  function myFetch(url, options) {
    return fetch(url, options)
      .then(function (response) {
        const content = response.headers.get('content-type').match(/json/) ? response.json() : response.text()
        return response.ok ? content : Promise.reject(response.status + ' ' +response.statusText + '\n' + content)
      })
      .catch(function (error) {
        console.error(error)
      })
  }

  function fetchReload(url, options) {
    return myFetch(url, options)
      .then(function (response) {
        location.reload()
      })
  }
})()
