const fs = require('fs')
const path = require('path')
const stripHtml = require('string-strip-html')
const showdown = require('showdown')

const converter = new showdown.Converter({metadata: true})
const pageSize = 10

module.exports = ({express, makeHandler, templateGenerator, config}) => {
  function getArticles() {
    return fs.readdirSync(path.join(__dirname, '..', 'blog'))
      .filter(e => e.match(/\.md$/))
      .sort((a, b) => b.localeCompare(a))
  }

  function readArticle(fileName) {
    const md = fs.readFileSync(path.join(__dirname, '..', 'blog', fileName)).toString()
    const html = converter.makeHtml(md)
    const meta = converter.getMetadata()
    return {html, meta}
  }

  function shorten(html) {
    return stripHtml(html)
      .split(' ')
      .slice(0, 70)
      .join(' ')
      .concat('…')
      .split('\n')
      .map(l => `<p>${l}</p>`)
      .join('')
  }

  function showAll(pageNo) {
    const files = getArticles()
    const startEntryNo = (pageNo - 1) / pageSize
    const pageFiles = files.slice(startEntryNo, startEntryNo + pageSize - 1)
    const maxPage = Math.ceil(files.length / pageSize)
    const pages = Array.from({length: maxPage}, (_, i) => ({page: i + 1}))
    const prevPage = pageNo > 1 ? pageNo - 1 : false
    const nextPage = pageNo < maxPage ? pageNo + 1 : false

    const entries = pageFiles
      .map(fileName => {
        const {html, meta} = readArticle(fileName)

        return {
          ...meta,
          link: fileName.replace(/\.md$/, ''),
          text: shorten(html),
        }
      })
    return templateGenerator.generate('blog-list', {entries, pages, pageNo, prevPage, nextPage})
  }

  function showPage(name) {
    const files = getArticles()
    const fileName = name + '.md'
    const index = files.indexOf(fileName)
    const md = fs.readFileSync(path.join(__dirname, '..', 'blog', fileName)).toString()
    const text = converter.makeHtml(md)
    const meta = converter.getMetadata()
    const prevPage = index > 0 ? files[index - 1].replace(/\.md$/, '') : false
    const nextPage = index < files.length - 1 ? files[index + 1].replace(/\.md$/, '') : false
    const selflink = config.baseUrl + '/blog/' + name
    const facebook = 'https://www.facebook.com/sharer.php?u=' + encodeURIComponent(selflink)
    const twitter = 'https://twitter.com/share?url=' + encodeURIComponent(selflink) + '&text=' + encodeURIComponent(meta.title)
    return templateGenerator.generate('blog-entry', {text, ...meta, prevPage, nextPage, facebook, twitter})
  }

  function showImage(name, res) {
    res.sendFile(path.resolve(__dirname, '..', 'blog', name))
  }

  function get3Posts() {
    return getArticles()
      .slice(0, 3)
      .map(fileName => {
        const {html, meta} = readArticle(fileName)
        return {
          img: meta.image,
          link: fileName.replace(/\.md$/, ''),
          title: meta.title,
          content: shorten(html),
        }
      })
  }

  const router = express.Router()

  router.get('/', makeHandler(req => showAll(req.query.page || 1), {type: 'send'}))
  router.get('/lastthree', makeHandler(get3Posts, {type: 'send'}))
  router.get('/images/:imageName', (req, res) => showImage(req.params.imageName, res))
  router.get('/:pageName', makeHandler(req => showPage(req.params.pageName), {type: 'send'}))

  return router
}
