'use strict'

const fs = require('fs')
const path = require('path')
const Mustache = require('mustache')

function getTemplate(name) {
  return '' + fs.readFileSync(path.join(__dirname, '/../templates/' + name + '.mustache'))
}

module.exports = ({globalData = {}, subTemplates = []}) => {
  const sub = {}
  subTemplates.forEach(name => {
    sub[name] = getTemplate(name)
  })

  return {
    generate: (templateName, data = {}) => {
      return Mustache.render(getTemplate(templateName), {...globalData, ...data}, sub)
    }
  }
}
