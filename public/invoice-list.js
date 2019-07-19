var authorization = getAuthToken()
setMenuState()

document.querySelectorAll('.setPayment').forEach(function (el) {
  el.onclick = function (event) {
    var row = el.parentNode.parentNode
    var method = row.className === 'open' ? 'PUT' : 'DELETE'
    fetch('orga/invoices/' + row.id + '/paid', {method, headers: {authorization}})
      .then(function (result) {
        if (result.ok) {
          location.reload()
        } else {
          return result.json()
        }
      })
      .then(function (result) {
        return result && alert(result.error)
      })
  }
})

document.querySelectorAll('.delete').forEach(function (el) {
  el.onclick = function (event) {
    fetch('orga/invoices/' + el.parentNode.parentNode.id, {method: 'DELETE', headers: {authorization}})
      .then(function (result) {
        if (result.ok) {
          location.reload()
        } else {
          return result.json()
        }
      })
      .then(function (result) {
        return result && Promise.reject(result.error)
      })
      .catch(function (error) {
        alert(error)
      })
  }
})
