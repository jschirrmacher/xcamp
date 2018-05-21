'use strict'

const fs = require('fs')
const path = require('path')
const Mustache = require('mustache')

function getTemplate(name) {
  return '' + fs.readFileSync(path.join(__dirname, '/../templates/' + name + '.mustache'))
}

module.exports = {
  generate: (templateName, data = {}, subTemplates = []) => {
    const sub = {}
    subTemplates.forEach(name => {
      sub[name] = getTemplate(name)
    })
    return Mustache.render(getTemplate(templateName), data, sub)
  }
}