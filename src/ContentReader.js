const fs = require('fs')
const path = require('path')
const showdown = require('showdown')
const stripHtml = require('string-strip-html')

const converter = new showdown.Converter({
  metadata: true,
  parseImgDimensions: true,
  simplifiedAutoLink: true,
  openLinksInNewWindow: true
})

module.exports = ({logger, config}) => {
  const contentPath = path.join(config.basePath, 'content')
  const pages = {}

  fs.watch(contentPath, {recursive: true}, (eventType, fileName) => {
    logger.info(`File ${eventType}: ${fileName}`)
    if (fileName) {
      delete pages[fileName]
    }
  })

  return {
    contentPath,

    getPageContent(pageName, type, folder) {
      folder = folder || type
      const fileName = pageName + '.md'
      const id = type + '/' + pageName
      if (pages[id] && pages[id].expiry > +new Date()) {
        return pages[id].info
      }
      const content = fs.readFileSync(path.join(contentPath, folder, fileName)).toString()
        .replace(/\((#.*)\)/g, `(${folder}/${pageName}$1)`)

      const html = converter.makeHtml(content)
      const meta = converter.getMetadata()
      meta.image = type + '/' + meta.image
      meta.title = meta.title || pageName
      meta.layout = meta.layout || 'standard-page'
      meta.pageName = pageName
      meta.fileName = fileName
      meta.type = type
      if (meta.authorPage) {
        const authorPage = this.getPageContent(meta.authorPage, 'team')
        meta.author = authorPage.meta.title
      }
      const previewText = shorten(html, 40)
      const expiry = +new Date() + 60000
      pages[id] = {info: {meta, html, previewText}, expiry}
      return pages[id].info
    },

    getPages(type, folder) {
      folder = folder || type
      const basePath = path.join(contentPath, folder)
      return fs.readdirSync(basePath)
        .filter(e => e.match(/\.md$/))
        .sort((a, b) => b.localeCompare(a))
        .map(e => this.getPageContent(e.replace(/\.md$/, ''), type, folder))
    },
  }

  function shorten(html, size) {
    return stripHtml(html.split(/<!--\s*more\s*-->/)[0]).replace(/\n/g, ' ')
      .split(' ')
      .slice(0, size)
      .join(' ')
      .concat('…')
      .split('\n')
      .map(l => `<p>${l}</p>`)
      .join('')
  }
}