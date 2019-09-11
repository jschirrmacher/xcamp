const fs = require('fs')
const path = require('path')
const stripHtml = require('string-strip-html')
const showdown = require('showdown')

const blogPath = path.resolve(__dirname, '..', '..', 'blog')
const converter = new showdown.Converter({metadata: true})
const pageSize = 10

module.exports = ({express, makeHandler, templateGenerator, config}) => {
  function getArticles() {
    return fs.readdirSync(blogPath)
      .filter(e => e.match(/\.md$/))
      .sort((a, b) => b.localeCompare(a))
  }

  function readArticle(fileName) {
    const pageName = fileName.replace(/\.md$/, '')
    const md = fs.readFileSync(path.join(blogPath, fileName))
      .toString()
      .replace(/\((#.*)\)/g, `(blog/${pageName}$1)`)
      .replace(/(!\[.*?])\((.*?)\)/g, '$1(blog/$2)')
    const html = converter.makeHtml(md)
    const meta = converter.getMetadata()
    meta.image = meta.image ? 'blog/' + meta.image : meta.image
    return {html, meta}
  }

  function shorten(html, size) {
    return stripHtml(html.split(/<!--\s*snip\s*-->/)[0])
      .split(' ')
      .slice(0, size)
      .join(' ')
      .concat('…')
      .split('\n')
      .map(l => `<p>${l}</p>`)
      .join('')
  }

  function showAll(pageNo) {
    const files = getArticles()
    const startEntryNo = (pageNo - 1) / pageSize
    const pageFiles = files.slice(startEntryNo, startEntryNo + pageSize)
    const maxPage = Math.ceil(files.length / pageSize)
    const pages = Array.from({length: maxPage}, (_, i) => ({
      page: i + 1,
      active: i + 1 === pageNo ? 'active' : undefined
    }))
    const prevPage = pageNo > 1 ? pageNo - 1 : false
    const nextPage = pageNo < maxPage ? pageNo + 1 : false

    const entries = pageFiles
      .map(fileName => {
        const {html, meta} = readArticle(fileName)

        return {
          ...meta,
          link: fileName.replace(/\.md$/, ''),
          text: shorten(html, 70),
        }
      })
    return templateGenerator.generate('blog-list', {entries, pages, pageNo, prevPage, nextPage})
  }

  function showPage(name) {
    const files = getArticles()
    const fileName = name + '.md'
    const index = files.indexOf(fileName)
    if (index < 0) {
      const imageFileName = path.resolve(blogPath, name)
      if (fs.existsSync(imageFileName)) {
        return {sendFile: imageFileName}
      } else {
        throw Error({message: 'File not found', status: 404})
      }
    } else {
      const {html, meta} = readArticle(fileName)
      const prevPage = index > 0 ? files[index - 1].replace(/\.md$/, '') : false
      const nextPage = index < files.length - 1 ? files[index + 1].replace(/\.md$/, '') : false
      const selflink = config.baseUrl + '/blog/' + name
      const facebook = 'https://www.facebook.com/sharer.php?u=' + encodeURIComponent(selflink)
      const twitter = 'https://twitter.com/share?url=' + encodeURIComponent(selflink) + '&text=' + encodeURIComponent(meta.title)
      const otherEntries = getNumPosts(5, name)
      const hasOthers = otherEntries.length
      return templateGenerator.generate('blog-entry', {text: html, ...meta, prevPage, nextPage, hasOthers, otherEntries, facebook, twitter})
    }
  }

  function getNumPosts(num = 3, exclude = null) {
    return getArticles()
      .filter(fileName => fileName.replace(/\.md$/, '') !== exclude)
      .slice(0, num)
      .map(fileName => {
        const {html, meta} = readArticle(fileName)
        return {
          img: meta.image,
          link: fileName.replace(/\.md$/, ''),
          title: meta.title,
          content: shorten(html, 40),
        }
      })
  }

  const router = express.Router()

  router.get('/', makeHandler(req => showAll(req.query.page || 1), {type: 'send'}))
  router.get('/lastthree', makeHandler(() => getNumPosts(), {type: 'send'}))
  router.get('/:pageName', makeHandler(req => showPage(req.params.pageName), {type: 'send'}))

  return router
}
