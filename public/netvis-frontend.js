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
    return new Promise(resolve => {
      function close() {
        form.parentNode.removeChild(form)
        resolve()
      }
      const form = document.createElement('form')
      form.setAttribute('class', 'detailForm' + (data.me ? ' own' : ''))
      data.image = data.image || '/user.png'
      form.innerHTML = detailFormTemplate(data)
      form.getElementsByClassName('close')[0].addEventListener('click', event => {
        event.preventDefault()
        close()
      })
      form.addEventListener('submit', event => {
        event.preventDefault()
        const headers = {'content-type': 'application/json'}
        const body = JSON.stringify(getFormDataAsObject(form))
        fetch('/persons/' + id, {method: 'PUT', headers, body})
          .then(() => close())
      })
      document.body.appendChild(form)
    })
  }

  const network = new Network('/network', '#root', {nameRequired, newNode, newLink, showDetails})
})(Handlebars)
