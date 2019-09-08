const fs = require('fs')
const path = require('path')
const stripHtml = require("string-strip-html")
const showdown = require('showdown')

const converter = new showdown.Converter({metadata: true})
const pageSize = 10

module.exports = ({express, makeHandler, templateGenerator}) => {
  function getArticles() {
    return fs.readdirSync(path.join(__dirname, '..', 'blog')).filter(e => e.match(/\.md$/))
      .sort((a, b) => b.localeCompare(a))
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
      .map(e => {
        const md = fs.readFileSync(path.join(__dirname, '..', 'blog', e)).toString()
        const html = converter.makeHtml(md)
        const meta = converter.getMetadata()

        return {
          ...meta,
          link: e.replace(/\.md$/, ''),
          text: stripHtml(html)
            .split(' ')
            .slice(0, 70)
            .join(' ')
            .concat('…')
            .split('\n')
            .map(l => `<p>${l}</p>`)
            .join(''),
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
    return templateGenerator.generate('blog-entry', {text, ...meta, prevPage, nextPage})
  }

  function showImage(name, res) {
    res.sendFile(path.resolve(__dirname, '..', 'blog', name))
  }

  const router = express.Router()

  router.get('/', makeHandler(req => showAll(req.query.page || 1), {type: 'send'}))
  router.get('/images/:imageName', (req, res) => showImage(req.params.imageName, res))
  router.get('/:pageName', makeHandler(req => showPage(req.params.pageName), {type: 'send'}))

  return router
}
