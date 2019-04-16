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


function showMessage(msg, type = 'info') {
  var container = document.createElement('div')
  container.className = 'alert type-' + type

  var content = document.createElement('div')
  content.className = 'alert-content'
  content.innerText = msg
  const closeButton = document.createElement('div')
  closeButton.className = 'close'
  closeButton.addEventListener('click', function () {
    container.remove()
  })
  content.appendChild(closeButton)
  container.appendChild(content)
  document.body.appendChild(container)
}
