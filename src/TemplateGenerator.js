'use strict'

const fs = require('fs')
const path = require('path')
const Mustache = require('mustache')

const templatesFolder = path.join(__dirname, 'templates')
const templatesSubFolder = path.join(templatesFolder, 'sub')

function getTemplate(name) {
  return '' + fs.readFileSync(path.join(templatesFolder, name + '.mustache'))
}

function getSubTemplates() {
  const sub = {}
  fs.readdirSync(templatesSubFolder).forEach(name => {
    sub[name.replace(/.mustache/, '')] = '' + fs.readFileSync(path.join(templatesSubFolder, name))
  })
  return sub
}

module.exports = (config) => {
  const sub = getSubTemplates()

  return {
    generate: (templateName, data = {}) => {
      return Mustache.render(getTemplate(templateName), {...config, ...data}, sub)
    }
  }
}
