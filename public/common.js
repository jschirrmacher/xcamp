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

function setupMail2InfoLink(link, mailBody) {
  link.addEventListener('click', function (e) {
    e.preventDefault()
    const subject = encodeURIComponent(link.dataset.message)
    const body = mailBody ? '&body=' + encodeURIComponent(mailBody) : ''
    location.href = 'mailto:netvis@xcamp.co?subject=' + subject + body
    return false
  })
  link.innerText = 'netvis@xcamp.co'
}

document.querySelectorAll('.mail2info').forEach(setupMail2InfoLink)

function getAuthToken() {
  const token = document.cookie.match(new RegExp('(^| )token=([^;]+)'))
  return token ? token[2] : null
}

function isJWTValid() {
  const token = getAuthToken()
  if (token) {
    const parts = token.split('.')
    if (parts.length === 3) {
      try {
        const part1 = JSON.parse(atob(parts[0]))
        const part2 = JSON.parse(atob(parts[1]))
        return part1.typ && part1.typ === 'JWT' && part2.iat && part2.exp && part2.sub
      } catch (e) {
      }
    }
  }
  return false
}

function getSessionState() {
  return new Promise(function (resolve, reject) {
    const authorization = getAuthToken()
    return fetch('session', {headers: {authorization}})
      .then(function (response) {
        return response.ok ? response.json() : Promise.reject('Netzwerkfehler - bitte später noch einmal versuchen.')
      })
      .then(resolve)
      .catch(reject)
  })
}

function setDocumentState(loggedIn) {
  document.body.classList.toggle('logged-in', loggedIn)
  document.body.classList.toggle('logged-out', !loggedIn)
}

function setMenuState(getUserData = false) {
  if (getUserData || !isJWTValid()) {
    return getSessionState().then(function (data) {
      setDocumentState(data.loggedIn)
      return data
    })
  } else {
    setDocumentState(true)
    return Promise.resolve({loggedIn: true})
  }
}

const menuSwitches = document.querySelectorAll('.toggle-menu')
Array.from(menuSwitches).forEach(sw => sw.addEventListener('click', e => {
  e.preventDefault()
  e.target.classList.toggle('opened')
  return false
}))
