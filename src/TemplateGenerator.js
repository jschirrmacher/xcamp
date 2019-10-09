'use strict'

const fs = require('fs')
const path = require('path')
const Mustache = require('mustache')

const templatesFolder = path.join(__dirname, '..', 'content', 'templates')
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
  return {
    generate: (templateName, data = {}) => {
      const selflink = config.baseUrl
      const sub = getSubTemplates()
      return Mustache.render(getTemplate(templateName), {...config, selflink, ...data}, sub)
    }
  }
}
