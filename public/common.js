function select(selector, where = document) {
  return {
    forEach(callback) {
      where.querySelectorAll(selector).forEach(callback)
    },

    addEventListener(eventType, listener) {
      where.querySelectorAll(selector).forEach(function (el) {
        el.addEventListener(eventType, function (event) {
          event.preventDefault()
          listener(event, el)
        })
      })
    }
  }
}

function encodeParams(params, otherOptions) {
  var body = Object.keys(params).map(function (key) {
    return key + '=' + encodeURIComponent(params[key])
  }).join('&')
  return Object.assign({body, headers: {'Content-Type': 'application/x-www-form-urlencoded'}}, otherOptions)
}

function myFetch(url, options) {
  return fetch(url, options)
    .then(function (response) {
      return response.headers.get('content-type').match(/json/) ? response.json() : response.text()
        .then(function (content) {
          return response.ok ? content : Promise.reject(response.status + ' ' + response.statusText + '\n' + content)
        })
    })
    .catch(function (error) {
      console.error(error)
      throw error
    })
}

function fetchReload(url, options) {
  return myFetch(url, options)
    .then(function (response) {
      location.reload()
    })
}


function showMessage(msg) {
  var div = document.createElement('div')
  var span = document.createElement('div')
  span.innerText = msg
  div.className = 'alert'
  div.addEventListener('click', function () {
    div.remove()
  })
  div.appendChild(span)
  document.body.appendChild(div)
}
