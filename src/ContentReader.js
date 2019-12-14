const fs = require('fs')
const path = require('path')
const showdown = require('showdown')
const stripHtml = require('string-strip-html')
const chokidar = require('chokidar')

const gallery = () => {
  return [{
    type: 'output',
    regex: /--slider(.*?)--slider/gs,
    replace: '<div class="slider">$1</div>'
  }, {
    type: 'output',
    regex: /<li>\s*<p>=(.+?)<\/p>/gs,
    replace: '<li class="$1">'
  }, {
    type: 'lang',
    regex: /%\s*(\w+)\s+(.*?)%/gs,
    replace: '<span class="$1">$2</span>'
  }]
}

const converter = new showdown.Converter({
  metadata: true,
  parseImgDimensions: true,
  simplifiedAutoLink: true,
  openLinksInNewWindow: true,
  extensions: [gallery]
})

module.exports = ({logger, config}) => {
  const contentPath = path.join(config.basePath, 'content')
  const pages = {}

  const watcher = chokidar.watch(contentPath).on('all', (event, fileName) => {
    delete pages[fileName.replace(contentPath, '')]
  })

  return {
    contentPath,

    stop() {
      watcher.close()
    },

    getPageContent(pageName) {
      const fileName = pageName + '.md'
      if (pages[pageName] && pages[pageName].expiry > +new Date()) {
        return pages[pageName].info
      }
      const folder = path.dirname(pageName)
      const prefix = folder === '/' ? '' : folder + '/'
      const content = fs.readFileSync(path.join(contentPath, fileName)).toString()
        .replace(/(!\[.*?])\((?!https?:\/\/)/g, '$1(' + prefix)
      const html = converter.makeHtml(content)
        .replace(/<a href="#(.*)?".*?>/g, `<a href="${pageName}#$1">`)
      const meta = converter.getMetadata()
      meta.pageName = pageName
      meta.id =path.basename(pageName)
      meta.title = meta.title || meta.pageName
      meta.layout = meta.layout || 'standard-page'
      meta.image = meta.image && (path.dirname(pageName) + '/' + meta.image)
      meta.fileName = fileName
      if (meta.authorPage) {
        const authorPage = this.getPageContent('team/' + meta.authorPage)
        meta.author = authorPage.meta.title
      }
      const excerpt = shorten(html, 40)
      const expiry = +new Date() + 60000
      pages[pageName] = {info: {meta, html, excerpt}, expiry}
      return pages[pageName].info
    },

    getPages(folder) {
      const basePath = path.join(contentPath, folder)
      return fs.readdirSync(basePath)
        .filter(e => e.match(/\.md$/))
        .sort((a, b) => b.localeCompare(a))
        .map(e => this.getPageContent(folder + '/' + e.replace(/\.md$/, '')))
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
