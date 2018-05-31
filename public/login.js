var loginForm = document.getElementById('login-form')

loginForm.addEventListener('submit', function (event) {
  event.preventDefault()
  var headers = {'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'}
  var method = loginForm.getAttribute('method')
  var body = Array.from(loginForm.elements)
    .filter(function (el) {
      return !!el.name
    })
    .map(function (el) {
      return el.name + "=" + encodeURIComponent(el.value)
    })
    .join("&")

  fetch(loginForm.getAttribute('action'), {credentials: 'same-origin', method, headers, body})
    .then(function (result) {
      return result.ok ? result.json() : Promise.reject(result.status + ' ' + result.statusText)
    })
    .then(function (data) {
      window.location.href = loginForm.elements.url.value
    })
    .catch(function (error) {
      console.error(error)
    })
  return false
})
