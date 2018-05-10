function bindHandler(className, eventType, callback) {
  forEachElementOfClass(className, function (element) {
    element.addEventListener(eventType, function (event) {
      event.preventDefault()
      callback(element)
    })
  })
}

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
      return response.ok ? content : Promise.reject(response.status + ' ' + response.statusText + '\n' + content)
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
