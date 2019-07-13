/*global Handlebars, Network*/
'use strict'

const maxImageHeight = 300
const maxImageWidth = 240

const texts = {
  roots: 'Events',
  topics: 'Themen',
  persons: 'Interessierte Personen',
  info: 'Beschreibung'
}

const icons = {
  roots: '🔥',
  topics: '💬',
  persons: '👤',
  info: '✍'
}

let network
let userInfo = {}
let myNode
const what = location.search.match(/what=(\w*)/) ? RegExp.$1 : 'topic'
const history = location.search.match(/year=(\d+)/) ? RegExp.$1 + '/' : ''
let detailsNode = location.hash && location.hash.replace('#', '')
const profileButton = document.querySelector('#profile')

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
    function getValue(el) {
      if (el.type === 'checkbox') {
        return el.checked && el.value
      } else {
        return el.innerText
      }
    }
    function setData(data, el) {
      return Object.assign(data, {[el.dataset.name]: getValue(el)})
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
        tags: (node.links.topics && node.links.topics.map(link => ({id: link.id, name: link.target.name}))) || [],
        accessCode: userInfo.access_code,
        setText: userInfo.hasPasswordSet ? 'ändern' : 'setzen',
        change: userInfo.hasPasswordSet
      }))
      form.classList.toggle('editable', !!data.editable)
      form.classList.add(data.type)

      const ticketUrl = window.location.origin + '/tickets/'
      select('.ticketNo').forEach(el => QRCode.toCanvas(el, ticketUrl + el.id))
      select('.account').addEventListener('click', () => window.open('accounts/my'))
      select('.talk').addEventListener('click', () => {
        form.classList.add('talk-is-open')
      })
      select('#back-from-talk').addEventListener('click', () => {
        form.classList.remove('talk-is-open')
      })

      const pwd = document.getElementById('password')
      const pwd2 = document.getElementById('password-repeat')
      select('.change-pwd').addEventListener('click',() => {
        pwd.value = ''
        pwd2.value = ''
        document.querySelector('#personDetails').style.display = 'none';
        document.querySelector('#chgPwdForm').style.display = 'block';
      })

      select('#chg-pwd-form').addEventListener('submit', () => {
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
      const existingTags = tagView.querySelector('#existing-tags')
      const newTag = tagView.querySelector('.new-tag')
      const profilePic = form.querySelector('.profile-picture')

      const newTagContainer = tagView.querySelector('.new-tag-container')
      existingTags.addEventListener('click', selectExistingTag)
      newTag.addEventListener('blur', () => setTimeout(emptyTopicsList, 5000))
      newTag.addEventListener('input', e => updateTopicsList(e.target.innerHTML))
      emptyTopicsList()

      form.addEventListener('input', debounce(e => !e.target.classList.contains('new-tag') && save(), 1000))
      newTag.addEventListener('keydown', e => (e.key === ',' || e.key === 'Enter') && handleCreateTagEvent(e))
      form.addEventListener('click', e => e.target.classList.contains('delete') && deleteTag(e.target.parentNode))
      select('.upload', form).forEach(el => el.addEventListener('change', fileUploadHandler))

      select('.command').forEach(el => {
        el.classList.toggle('active', !el.dataset.visible || !!eval(el.dataset.visible))
        el.addEventListener('click', event => {
          network[event.target.dataset.cmd](node, event.target.dataset.params)
          window.history.pushState(null, null, location.pathname)
          resolve()
        })
      })

      select('.close', form).forEach(el => el.addEventListener('click', event => {
        event.preventDefault()
        window.history.pushState(null, null, location.pathname)
        resolve()
      }))

      select('.mail2info').forEach(link => setupMail2InfoLink(link, 'node=' + id))

      function save() {
        const headers = {'content-type': 'application/json', authorization}
        const data = getFormDataAsObject(form)
        const body = JSON.stringify(data)
        return fetch(`network/${node.type}s/${node.id}`, {method: 'PUT', headers, body})
          .then(result => result.json())
          .then(result => {
            result.nodes2create.forEach(n => network.addNode(n))
            network.nodes.some(n => node.id === n.id && Object.assign(n, result.node))
            network.update()
            return result.node
          })
          .catch(console.error)
      }

      function emptyTopicsList() {
        existingTags.innerHTML = ''
      }

      function updateTopicsList(search) {
        const tags = (node.links.topics && node.links.topics.map(link => link.target.name)) || []
        const pattern = new RegExp(search, 'i')
        function byRelevantTopics(n) {
          return n.type === 'topic' && Object.keys(n.linkedNodes).length && !tags.includes(n.name) && n.name.match(pattern)
        }

        const topics = network.nodes
          .filter(byRelevantTopics)
          .map(node => node.name)
          .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        existingTags.innerHTML = topics.map(topic => '<li>' + topic + '</li>').join('')
      }

      function selectExistingTag(e) {
        newTag.innerText = e.target.innerText
        emptyTopicsList()
        createTag()
      }

      function deleteTag(el) {
        const topicName = el.innerText
        const linkId = parseInt(el.dataset.id)
        el.remove()
        const headers = {'content-type': 'application/json', authorization}
        return fetch(`network/nodes/${node.id}/topics/${topicName}`, {method: 'DELETE', headers})
          .then(result => result.json())
          .then(result => {
            node.links.topics = node.links.topics.filter(l => l.id !== linkId)
            network.removeLinks(result.links2delete)
            network.update()
          })
          .catch(console.error)
      }

      function createTag() {
        const value = newTag.innerText.trim()
        newTag.innerText = ''
        const newPos = tagView.children.length - 1
        const foundPos = Array.from(tagView.children)
          .map(el => el.innerText)
          .findIndex(t => !t.toLowerCase().localeCompare(value.toLowerCase()))
        if (foundPos >= 0 && foundPos < newPos) {
          showMessage('Das Thema ist bereits zugeordnet')
          return
        }
        const el = document.createElement('span')
        el.className = 'tag'
        el.innerText = value
        const del = document.createElement('span')
        del.className = 'delete'
        el.append(del)
        tagView.insertBefore(el, newTagContainer)
        const headers = {'content-type': 'application/json', authorization}
        return fetch(`network/nodes/${node.id}/topics/${value}`, {method: 'PUT', headers})
          .then(result => result.json())
          .then(result => {
            result.nodes2create.forEach(n => network.addNode(prepareNode(n)))
            result.links2create.forEach(l => {
              const node = network.getNode(l.target.id)
              node.visible = true
              network.updateNode(node)
              network.diagram.add([node], [])
            })
            network.addLinks(result.links2create)
            network.nodes.some(n => {
              if (node.id === n.id) {
                n.links.topics.push(result.topic.id)
                network.updateNode(n)
                const newLink = n.links.topics.find(l => l.target.id === result.topic.id || l.source.id === result.topic.id)
                el.setAttribute('data-id', newLink.id)
                return true
              }
            })
            network.update()
          })
          .catch(console.error)
      }

      function handleCreateTagEvent(event) {
        event.preventDefault()
        if (newTag.innerText.trim()) {
          createTag()
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
                profileButton.style.backgroundImage = 'url(' + person.node.image + ')'
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
    const fontSize = node.type === 'topic' && node.links ? ((Math.log((node.links.persons || []).length + 3) + 1) / 3) : 1
    const moreThan1PersonConnected = node.links && node.links.persons && node.links.persons.length > 1

    return Object.assign({}, node, {
      visible: (node.type === what && (node.type !== 'topic' || moreThan1PersonConnected)) || node.open || node.id === detailsNode,
      shape: 'circle',
      radius: node.radius || fontSize * 50,
      className: node.type,
      links: node.type === 'topic' ? getTopicInfoAsLink(node.links) : node.links,
      hiddenPersonLinks: getNumberOfHiddenPersonLinks(node),
      fontSize
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

  function getNumberOfHiddenPersonLinks(node) {
    if (!node.links || !node.links.persons) {
      return 0
    }
    return node.links.persons.filter(l => !l.visible).length
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
  nodeRenderer.renderRefLinks = function (enter) {
    enter.append('g')
      .attr('class', 'reflinks')
      .selectAll(null)
      .data(d => {
        const y = d.bbox.y + d.bbox.height + 24
        return Object.keys(d.links || {}).map((type, i) => ({type, x: d.bbox.x, y: y + i * 24}))
      })
      .enter()
      .append('g')
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .attr('data-ref', d => d.type)
      .append('text')
      .text(d => d.name = icons[d.type] + ' ' + texts[d.type])
      .call(d => this.wrap(d, 200, true))
  }
  const origRenderCircle = nodeRenderer.renderCircle
  nodeRenderer.renderCircle = function (enter) {
    origRenderCircle.call(this, enter)
    const g = enter.append('g')
      .attr('class', 'cta')
      .attr('transform', d => 'translate(' + ((d.radius || 50) * 0.7) + ' -' + ((d.radius || 50) * 0.7) + ')')
    g.append('circle')
    g.append('text')
  }
  nodeRenderer.update = function (selector) {
    selector.selectAll('.cta')
      .classed('hidden_persons', d => !!d.hiddenPersonLinks)
      .selectAll('text').text(d => Math.min(99, d.hiddenPersonLinks))
  }

  function toggleNode(node, ref) {
    network.toggleNodes(node, ref)
    node.hiddenPersonLinks = getNumberOfHiddenPersonLinks(node)
    network.updateNodes([node, ...Object.values(node.linkedNodes).filter(n => n.visible)])
  }

  network = new Network({
    dataUrl: history + 'network',
    domSelector: '#root',
    maxLevel: 3,
    collide: function (collide) {
      return collide.radius(d => (d.radius || d.width / 2 || 50) * 1.7)
    },
    velocityDecay: 0.8,
    charge: function (manyBody) {
      return manyBody.strength(500)
    },
    forceX: function (force) {
      return force.strength(0.02)
    },
    forceY: function (force) {
      return force.strength(0.02)
    },
    nodeRenderer,
    useMarkers: true,
    handlers: {
      prepare(data) {
        data.nodes = data.nodes.map(prepareNode)
        myNode = data.myNode
        return data
      },

      clickOnNode(node) {
        if (node.type === 'topic') {
          toggleNode(node, 'persons')
        } else {
          network.showDetails(node)
        }
      },

      clickOnRefLink(node, ref) {
        if (ref === 'info') {
          network.showDetails(node)
        } else {
          toggleNode(node, ref)
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
        profileButton.style.backgroundImage = 'url(' + data.profileImage + ')'
      }
    })
})
script.src = 'js-netvis/dist/bundle.js'
document.body.appendChild(script)
