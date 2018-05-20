/*global Handlebars*/

(function (Handlebars) {
  'use strict'

  const source = document.getElementById('detailForm').innerHTML
  const detailFormTemplate = Handlebars.compile(source)

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
    return new Promise(function(resolve) {
      const form = document.createElement('form')
      form.setAttribute('class', 'detailForm' + (data.me ? ' own' : ''))
      data.topicsValue = data.topics ? data.topics.map(function (topic) {
        return topic.name
      }).join(',') : ''
      form.innerHTML = detailFormTemplate(data)
      document.body.appendChild(form)

      const tagView = form.getElementsByClassName('tag-view')[0]
      const tagStore = tagView.getElementsByClassName('tag-store')[0]
      const newTag = tagView.getElementsByClassName('new-tag')[0]
      const profilePic = form.getElementsByClassName('profile-picture')[0]

      function close() {
        form.parentNode.removeChild(form)
        resolve()
      }

      function deleteTag(event) {
        const value = event.target.parentNode.innerText
        tagStore.value = (tagStore.value ? tagStore.value.split(',') : []).filter(function(topic) {
          return topic !== value
        }).join(',')
        tagView.childNodes.forEach(function (topic) {
          if (topic.innerText === value) {
            topic.remove()
          }
        })
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

      form.getElementsByClassName('close')[0].addEventListener('click', function (event) {
        event.preventDefault()
        close()
      })

      form.addEventListener('submit', function (event) {
        event.preventDefault()
        if (newTag.value) {
          updateTopicsField(newTag.value)
        }
        const headers = {'content-type': 'application/json'}
        const data = getFormDataAsObject(form)
        data.topics = data.topics.split(',').map(function (topic) {
          return {name: topic}
        })
        const body = JSON.stringify(data)
        fetch('/persons/' + id, {method: 'PUT', headers, body})
          .then(close)
      })

      Array.from(form.getElementsByClassName('delete')).forEach(function (el) {
        el.addEventListener('click', deleteTag)
      })

      form.getElementsByClassName('upload')[0].addEventListener('change', function (event) {
        const body = new FormData()
        body.append('picture', event.target.files[0])
        fetch('/persons/' + id + '/picture', {method: 'PUT', body})
          .then(function (result) {
            return result.json()
          })
          .then(function (person) {
            profilePic.src = person.image
            // @todo update force diagram node content
          })
      })

      newTag.addEventListener('keydown', function (event) {
        if (event.key === ',' || event.key === 'Enter') {
          event.preventDefault()
          const value = event.target.value
          event.target.value = ''
          updateTopicsField(value)
        }
      })
    })
  }

  const network = new Network('/network', '#root', {nameRequired, newNode, newLink, showDetails})
})(Handlebars)
