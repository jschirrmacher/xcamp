var token = document.cookie.match(new RegExp('(^| )token=([^;]+)'))
var authorization = token ? token[2] : null

document.querySelectorAll('.setPayment').forEach(function (el) {
  el.onclick = function (event) {
    var row = el.parentNode.parentNode
    var method = row.className === 'open' ? 'PUT' : 'DELETE'
    fetch('/orga/invoices/' + row.id + '/paid', {method, headers: {authorization}})
      .then(function (result) {
        if (result.ok) {
          location.reload()
        } else {
          return result.json()
        }
      })
      .then(function (result) {
        alert(result.error)
      })
  }
})
