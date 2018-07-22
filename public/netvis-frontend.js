/*global Handlebars*/

var network

(function (Handlebars) {
  'use strict'

  const source = document.getElementById('detailForm').innerHTML
  const detailFormTemplate = Handlebars.compile(source)

  const token = document.cookie.match(new RegExp('(^| )token=([^;]+)'))
  const authorization = token ? token[2] : null

  function nameRequired() {
    return Promise.resolve(window.prompt('Name'))
  }

  function newNode(name) {
    console.log('New node', name)
    return {name, shape: 'circle'}
  }

  function newLink(link) {
    console.log('New link', link)
  }

  function getFormDataAsObject(form) {
    const data = {}

    function hasName(el) {
      return !!el.name
    }

    function setData(el) {
      data[el.name] = el.value
    }

    Array.from(form.elements).filter(hasName).forEach(setData)
    return data
  }

  function showDetails(data) {
    const id = data.uid
    window.history.pushState(null, null, '#' + id)
    return new Promise(function (resolve) {
      const form = document.createElement('form')
      form.setAttribute('class', 'detailForm' + (data.editable ? ' own' : ''))
      data.topicsValue = data.topics ? data.topics.map(function (topic) {
        return topic.name
      }).join(',') : ''
      form.innerHTML = detailFormTemplate(data)
      document.body.appendChild(form)

      const tagView = form.getElementsByClassName('tag-view')[0]
      const tagStore = tagView.getElementsByClassName('tag-store')[0]
      const newTag = tagView.getElementsByClassName('new-tag')[0]
      const profilePic = form.getElementsByClassName('profile-picture')[0]

      function close(result) {
        form.parentNode.removeChild(form)
        window.history.pushState(null, null, location.pathname)
        if (result) {
          return result.json().then(resolve)
        } else {
          resolve()
        }
      }

      function deleteTag(event) {
        const value = event.target.parentNode.innerText
        tagStore.value = (tagStore.value ? tagStore.value.split(',') : []).filter(function (topic) {
          return topic !== value
        }).join(',')
        tagView.childNodes.forEach(function (topic) {
          if (topic.innerText === value) {
            topic.remove()
          }
        })
        save()
      }

      function updateTopicsField(value) {
        tagStore.value = (tagStore.value ? tagStore.value.split(',') : []).concat([value]).join(',')
        const el = document.createElement('span')
        el.className = 'tag'
        el.innerText = value
        const del = document.createElement('span')
        del.className = 'delete'
        del.addEventListener('click', deleteTag)
        el.append(del)
        tagView.insertBefore(el, newTag)
      }

      function save() {
        if (newTag.value) {
          updateTopicsField(newTag.value)
        }
        const headers = {'content-type': 'application/json', authorization}
        const data = getFormDataAsObject(form)
        data.topics = (data.topics && data.topics.split(',').filter(String).map(function (topic) {
          return {name: topic}
        })) || []
        const body = JSON.stringify(data)
        return fetch('persons/' + id, {method: 'PUT', headers, body})
          .then(result => result.json())
          .then(result => {
            result.nodes2create.forEach(n => network.addNode(n))
            network.removeLinks(result.links2delete)
            network.addLinks(result.links2create)
            network.update()
          })
      }

      form.getElementsByClassName('close')[0].addEventListener('click', function (event) {
        event.preventDefault()
        close()
      })

      form.addEventListener('submit', function (event) {
        event.preventDefault()
        save().then(close)
      })

      Array.from(form.getElementsByClassName('delete')).forEach(function (el) {
        el.addEventListener('click', deleteTag)
      })

      var maxHeight = 150
      var maxWidth = 120
      form.getElementsByClassName('upload')[0].addEventListener('change', function (event) {
        var reader = new FileReader()
        reader.onload = function (e) {
          var image = new Image()
          image.onload = function () {
            if (image.width > image.height) {
              image.height *= maxHeight / image.width
              image.width = maxWidth
            } else {
              image.width *= maxHeight / image.height
              image.height = maxHeight
            }

            var canvas = document.createElement("canvas")
            canvas.width = image.width
            canvas.height = image.height
            canvas.getContext("2d").drawImage(image, 0, 0, image.width, image.height)

            var splitted = canvas.toDataURL().split(',')
            var mime = splitted[0].replace(/data:(.*);.*/, '$1')
            var binary = atob(splitted[1])
            var array = Array(binary.length)
            for (var i=0; i<binary.length; i++) {
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
      })

      newTag.addEventListener('keydown', function (event) {
        if (event.key === ',' || event.key === 'Enter') {
          event.preventDefault()
          const value = event.target.value
          event.target.value = ''
          updateTopicsField(value)
          save()
        }
      })
    })
  }

  function handleHash() {
    if (location.hash) {
      var id = location.hash.replace('#', '')
      network.showDetails({id, details: 'persons/' + id})
    }
  }

  function initialized() {
    network.scale(2.5 / Math.log(network.nodes.length))
    handleHash()
  }

  window.onpopstate = handleHash

  network = new Network('network', '#root', {nameRequired, newNode, newLink, showDetails, initialized})
  fetch('login', {headers: {authorization}})
    .then(function (response) {
      return response.ok ? response.json() : Promise.reject('Netzwerkfehler - bitte später noch einmal versuchen.')
    })
    .then(function (data) {
      document.getElementById('login').style.display = data.loggedIn ? 'none' : 'block'
    })
})(Handlebars)
