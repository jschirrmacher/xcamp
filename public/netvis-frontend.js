/*global Handlebars, Network*/
'use strict'

const maxImageHeight = 300
const maxImageWidth = 240

const texts = {
  topics: 'Themen',
  events: 'Events',
  persons: 'Interessierte Personen',
  info: 'Beschreibung'
}

const icons = {
  topics: '💬',
  events: '',
  persons: '👤',
  info: '✍'
}

let network
let userInfo = {}
let myNode
const what = location.search.match(/what=(\w*)/) ? RegExp.$1 : ''
const history = location.search.match(/year=(\d+)/) ? RegExp.$1 + '/' : ''
let detailsNode = location.hash && location.hash.replace('#', '')

const script = document.createElement('script')
script.addEventListener('load', function () {
  const source = document.getElementById('detailForm').innerHTML
  const detailFormTemplate = Handlebars.compile(source)

  const token = document.cookie.match(new RegExp('(^| )token=([^;]+)'))
  const authorization = token ? token[2] : null

  // Credit David Walsh (https://davidwalsh.name/javascript-debounce-function)
  function debounce(func, wait, immediate) {
    let timeout

    return function executedFunction() {
      const context = this
      const args = arguments

      const later = function() {
        timeout = null
        if (!immediate) func.apply(context, args)
      }

      const callNow = immediate && !timeout
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)

      if (callNow) func.apply(context, args)
    }
  }

  function getFormDataAsObject(form) {
    function setData(data, el) {
      return Object.assign(data, {[el.dataset.name]: el.innerText})
    }

    return Array.from(form.querySelectorAll('*[data-name]')).reduce(setData, {})
  }

  function showDetails(data, form, node) {
    const id = data.id
    window.history.pushState(null, null, '#' + id)
    return new Promise(resolve => {
      const editable = data.editable && 'contenteditable="true"'
      const linkTitles = Object.keys(node.links)
        .filter(type => type !== 'info')
        .map(type => ({type, title: `${icons[type]} ${texts[type]} einblenden`}))
      form.innerHTML = detailFormTemplate(Object.assign({}, data, {
        editable,
        linkTitles,
        accessCode: userInfo.access_code,
        setText: userInfo.hasPasswordSet ? 'ändern' : 'setzen',
        change: userInfo.hasPasswordSet
      }))
      form.classList.toggle('editable', !!data.editable)
      form.classList.add(data.type)

      const ticketUrl = window.location.origin + '/tickets/'
      forEachElementOfClass('ticketNo', el => QRCode.toCanvas(el, ticketUrl + el.id))
      bindHandler('printTicket', 'click', el => window.open('tickets/' + el.dataset.id + '/print'))
      bindHandler('account', 'click', () => window.open('accounts/my'))

      const pwd = document.getElementById('password')
      const pwd2 = document.getElementById('password-repeat')
      bindHandler('change-pwd', 'click',el => {
        pwd.value = ''
        pwd2.value = ''
        document.querySelector('#personDetails').style.display = 'none';
        document.querySelector('#chgPwdForm').style.display = 'block';
      })

      document.getElementById('chg-pwd-form').addEventListener('submit', function (event) {
        event.preventDefault()
        if (pwd.value !== pwd2.value) {
          showMessage('Passwörter stimmen nicht überein.')
          return false;
        }
        const headers = {'content-type': 'application/json', authorization}
        fetch('accounts/password', {method: 'POST', headers, body: JSON.stringify({password: pwd.value})})
          .then(result => result.json())
          .then(({message}) => showMessage(message))
          .catch(console.error)
          .then(() => {
            document.querySelector('#chgPwdForm').style.display = 'none';
            document.querySelector('#personDetails').style.display = 'block';
          })
        return false;
      })

      const tagView = form.querySelector('.tag-view')
      const newTag = tagView.querySelector('.new-tag')
      const profilePic = form.querySelector('.profile-picture')

      form.addEventListener('input', debounce(e => !e.target.classList.contains('new-tag') && save(), 1000))
      newTag.addEventListener('keydown', handleKeydownInNewTag)
      newTag.addEventListener('blur', handleCreateTagEvent)
      form.querySelectorAll('.delete').forEach(el => el.addEventListener('click', deleteTag))
      form.querySelectorAll('.upload').forEach(el => el.addEventListener('change', fileUploadHandler))

      forEachElementOfClass('command', el => {
        el.classList.toggle('active', !el.dataset.visible || !!eval(el.dataset.visible))
        el.addEventListener('click', event => {
          network[event.target.dataset.cmd](node, event.target.dataset.params)
          window.history.pushState(null, null, location.pathname)
          resolve()
        })
      })

      form.querySelectorAll('.close').forEach(el => el.addEventListener('click', event => {
        event.preventDefault()
        window.history.pushState(null, null, location.pathname)
        resolve()
      }))

      forEachElementOfClass('mail2info',link => {
        const subject = encodeURIComponent('Bitte aus dem XCamp-Netzwerk entfernen')
        link.setAttribute('href', 'mailto:netvis@xcamp.co?subject=' + subject + '&body=node=' + id)
        link.innerText = 'netvis@xcamp.co'
      })

      function save() {
        if (newTag.innerText.trim()) {
          createTag(newTag.innerText.trim())
          newTag.innerText = ''
        }
        const headers = {'content-type': 'application/json', authorization}
        const data = getFormDataAsObject(form)
        data.topics = Array.from(document.querySelectorAll('.tag'))
          .map(e => e.innerText.trim())
          .filter(String)
          .map(name => ({name}))
        const body = JSON.stringify(data)
        return fetch(`network/${node.type}s/${node.id}`, {method: 'PUT', headers, body})
          .then(result => result.json())
          .then(result => {
            result.nodes2create.forEach(n => network.addNode(n))
            network.removeLinks(result.links2delete)
            network.addLinks(result.links2create)
            network.nodes.some(n => node.id === n.id && Object.assign(n, result.node))
            network.update()
            return result.node
          })
      }

      function deleteTag(event) {
        const value = event.target.parentNode.innerText
        tagView.childNodes.forEach(function (topic) {
          if (topic.innerText === value) {
            topic.remove()
          }
        })
        save()
      }

      function createTag(value) {
        const el = document.createElement('span')
        el.className = 'tag'
        el.innerText = value
        const del = document.createElement('span')
        del.className = 'delete'
        el.append(del)
        tagView.insertBefore(el, newTag)
      }

      function handleCreateTagEvent(event) {
        event.preventDefault()
        const value = newTag.innerText.trim()
        if (value) {
          newTag.innerText = ''
          createTag(value)
          save()
        }
      }

      function handleKeydownInNewTag(event) {
        if (event.key === ',' || event.key === 'Enter') {
          handleCreateTagEvent(event)
        }
      }

      function fileUploadHandler(event) {
        const reader = new FileReader()
        reader.onload = function (e) {
          const image = new Image()
          image.onload = function () {
            if (image.width > image.height) {
              image.height *= maxImageHeight / image.width
              image.width = maxImageWidth
            } else {
              image.width *= maxImageHeight / image.height
              image.height = maxImageHeight
            }

            const canvas = document.createElement("canvas")
            canvas.width = image.width
            canvas.height = image.height
            canvas.getContext("2d").drawImage(image, 0, 0, image.width, image.height)

            const splitted = canvas.toDataURL().split(',')
            const mime = splitted[0].replace(/data:(.*);.*/, '$1')
            const binary = atob(splitted[1])
            const array = Array(binary.length)
            for (let i = 0; i < binary.length; i++) {
              array[i] = binary.charCodeAt(i)
            }

            const body = new FormData()
            body.append('picture', new Blob([new Uint8Array(array)], {type: mime}), event.target.files[0].name)
            fetch('network/persons/' + id + '/picture', {method: 'PUT', body, headers: {authorization}})
              .then(function (result) {
                return result.json()
              })
              .then(function (person) {
                profilePic.style.backgroundImage = 'url(' + person.node.image + ')'
              })
          }
          image.src = e.target.result
        }
        reader.readAsDataURL(event.target.files[0])
      }
    })
  }

  function handleHash() {
    if (location.hash) {
      const id = location.hash.replace('#', '')
      const node = network.getNode(id)
      if (!node.visible) {
        node.visible = true
        node.x = node.x || network.diagram.center.x
        node.y = node.y || network.diagram.center.y
        network.diagram.add([node])
        network.diagram.update()
      }
      network.showDetails(node)
    }
  }

  function prepareNode(node) {
    const getTopicInfoAsLink = links => ({...links, info: []})

    return Object.assign({}, node, {
      visible: node.type === what || node.open || node.id === detailsNode,
      shape: node.shape || (node.type === 'person' ? 'circle' : undefined),
      className: node.type,
      links: node.type === 'topic' ? getTopicInfoAsLink(node.links) : node.links
    })
  }

  function initialized() {
    handleHash()
    const profileButton = document.getElementById('profile')
    if (myNode) {
      profileButton.style.display = 'block'
      profileButton.addEventListener('click', e => {
        e.preventDefault()
        location.hash = myNode
      })
    }
  }

  const helpBox = document.querySelector('.help')
  document.getElementById('help').addEventListener('click', () => {
    helpBox.classList.add('open')
  })
  document.querySelector('.help .close').addEventListener('click', () => {
    helpBox.classList.remove('open')
  })

  window.onpopstate = handleHash

  const nodeRenderer = new NodeRenderer({showRefLinks: true})
  nodeRenderer.renderRefLinksContent = function (enter) {
    enter.text(d => icons[d.type] + ' ' + texts[d.type])
  }
  network = new Network({
    dataUrl: history + 'network',
    domSelector: '#root',
    maxLevel: 3,
    nodeRenderer,
    handlers: {
      prepare(data) {
        data.nodes = data.nodes.map(prepareNode)
        myNode = data.myNode
        return data
      },

      clickOnNode(node) {
        if (node.type === 'topic') {
          network.toggleNodes(node, 'persons')
        } else {
          network.showDetails(node)
        }
      },

      clickOnRefLink(node, ref) {
        if (ref === 'info') {
          network.showDetails(node)
        } else {
          network.toggleNodes(node, ref)
        }
      },

      showDetails,
      initialized
    }
  })

  fetch(history + 'session', {headers: {authorization}})
    .then(function (response) {
      return response.ok ? response.json() : Promise.reject('Netzwerkfehler - bitte später noch einmal versuchen.')
    })
    .then(function (data) {
      document.body.classList.toggle('logged-in', data.loggedIn)
      document.body.classList.toggle('logged-out', !data.loggedIn)
      if (data.loggedIn) {
        userInfo = data
      }
    })
})
script.src = 'js-netvis/dist/bundle.js'
document.body.appendChild(script)
