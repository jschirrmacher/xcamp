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

  function resetScanner() {
    video.removeAttribute('style')
    characteristics.setAttribute('style', 'display: none')
    characteristics.className = ''
  }

  function handleScan(content) {
    var code = decodeEntities(content).replace(/^.*\/tickets?\/(\w+).*/, '$1')
    var url = location.href.replace('/orga/checkin', '/tickets/' + code + '/checkin')
    fetch(url, {headers: {authorization}})
      .then(function (result) {
        return result.json()
      })
      .then(function (result) {
        console.log(result)
        characteristics.className = result.ok ? 'ok' : 'error'
        charImg.src = result.ok ? result.image : 'unknown.png'
        charName.innerText = result.ok ? result.name : 'Unbekanntes Ticket!'
        characteristics.setAttribute('style', 'display: inline-block')
        // video.setAttribute('style', 'display: none')
      })
  }

  var scanner = new Instascan.Scanner({video, backgroundScan: false})
  scanner.addListener('scan', handleScan)
  characteristics.addEventListener('click', resetScanner)
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
