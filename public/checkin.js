(function () {
  'use strict'

  var token = document.cookie.match(new RegExp('(^| )token=([^;]+)'))
  var authorization = token ? token[2] : null

  var element = document.createElement('div')
  var video = document.getElementById('preview')
  var characteristics = document.getElementById('characteristics')
  var charImg = document.getElementById('char-img')
  var charName = document.getElementById('char-name')

  function decodeEntities(str) {
    element.innerHTML = str.toString()
      .replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '')
      .replace(/<\/?\w(?:[^"'>]|"[^"]*"|'[^']*')*>/gmi, '')
    str = element.textContent
    element.textContent = ''
    return str
  }

  var scanner = new Instascan.Scanner({video, backgroundScan: false})
  scanner.addListener('scan', function (content) {
    fetch(decodeEntities(content) + '/checkin', {headers: {authorization}})
      .then(function (result) {
        return result.json()
      })
      .then(function (result) {
        console.log(result)
        characteristics.className = result.ok ? 'ok' : 'error'
        charImg.src = result.image
        charName.innerText = result.ok ? result.name : 'Unbekanntes Ticket!'
        characteristics.setAttribute('style', 'display: block')
        video.setAttribute('style', 'display: none')
        window.setTimeout(function () {
          video.removeAttribute('style')
          characteristics.setAttribute('style', 'display: none')
          characteristics.className = ''
        }, 5000)
      })
  })
  Instascan.Camera.getCameras().then(function (cameras) {
    if (cameras.length > 0) {
      scanner.start(cameras[0])
    } else {
      console.error('No cameras found.')
    }
  }).catch(function (e) {
    console.error(e)
  })
})()
