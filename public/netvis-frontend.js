/*global Handlebars, Network*/
'use strict'

const maxImageHeight = 300
const maxImageWidth = 240

const texts = {
  topics: 'Themen',
  events: 'Events',
  persons: 'Interessierte Personen'
}

let network
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
      const linkTitles = Object.keys(node.links).map(type => ({type, title: `${texts[type]} anzeigen`}))
      form.innerHTML = detailFormTemplate(Object.assign({}, data, {editable, linkTitles}))
      form.classList.toggle('editable', !!data.editable)
      form.classList.add(data.type)

      const tagView = form.querySelector('.tag-view')
      const newTag = tagView.querySelector('.new-tag')
      const profilePic = form.querySelector('.profile-picture')

      form.addEventListener('input', debounce(e => !e.target.classList.contains('new-tag') && save(), 1000))
      newTag.addEventListener('keydown', handleKeydownInNewTag)
      newTag.addEventListener('blur', handleCreateTagEvent)
      form.querySelectorAll('.delete').forEach(el => el.addEventListener('click', deleteTag))
      form.querySelectorAll('.upload').forEach(el => el.addEventListener('change', fileUploadHandler))

      document.querySelectorAll('.command').forEach(el => {
        el.classList.toggle('active', !el.dataset.visible || !!eval(el.dataset.visible))
        el.addEventListener('click', event => {
          network[event.target.dataset.cmd](node, event.target.dataset.params)
          window.history.pushState(null, null, location.pathname)
          resolve()
        })
      })

      form.querySelector('.close').addEventListener('click', event => {
        event.preventDefault()
        window.history.pushState(null, null, location.pathname)
        resolve()
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
        return fetch(`${node.type}s/${node.id}`, {method: 'PUT', headers, body})
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
            fetch('persons/' + id + '/picture', {method: 'PUT', body, headers: {authorization}})
              .then(function (result) {
                return result.json()
              })
              .then(function (person) {
                profilePic.src = person.image
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
      network.showDetails(network.nodes.find(n => n.id === id))
    }
  }

  function prepareNode(node) {
    return Object.assign({}, node, {
      visible: node.type === what || node.open || node.id === detailsNode,
      shape: node.shape || (node.type === 'person' ? 'circle' : undefined)
    })
  }

  window.onpopstate = handleHash

  const icons = {
    topics: '💬',
    interestedParties: '👤'
  }
  const nodeRenderer = new NodeRenderer({levelSteps: 0.15, showRefLinks: true})
  nodeRenderer.renderRefLinksContent = function (enter) {
    enter.text(d => icons[d.type])
  }
  network = new Network({
    dataUrl: history + 'network',
    domSelector: '#root',
    maxLevel: 3,
    nodeRenderer,
    handlers: {
      prepare(data) {
        return Object.assign(data, {nodes: data.nodes.map(prepareNode)})
      },

      showDetails,
      initialized: handleHash
    }
  })

  fetch(history + 'login', {headers: {authorization}})
    .then(function (response) {
      return response.ok ? response.json() : Promise.reject('Netzwerkfehler - bitte später noch einmal versuchen.')
    })
    .then(function (data) {
      document.getElementById('login').style.display = data.loggedIn ? 'none' : 'block'
    })
})
script.src = 'https://jschirrmacher.github.io/netvis/dist/bundle.js'
document.body.appendChild(script)
