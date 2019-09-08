const fs = require('fs')
const path = require('path')
const stripHtml = require("string-strip-html")
const showdown = require('showdown')

const converter = new showdown.Converter({metadata: true})
const pageSize = 10

module.exports = ({express, makeHandler, templateGenerator}) => {
  function showAll(pageNo) {
    const files = fs.readdirSync(path.join(__dirname, '..', 'blog')).filter(e => e.match(/\.md$/))
    const startEntryNo = (pageNo - 1) / pageSize
    const pageFiles = files.slice(startEntryNo, startEntryNo + pageSize - 1)
      .sort((a, b) => b.localeCompare(a))
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
    const md = fs.readFileSync(path.join(__dirname, '..', 'blog', name) + '.md').toString()
    const text = converter.makeHtml(md)
    const meta = converter.getMetadata()
    return templateGenerator.generate('blog-entry', {text, ...meta})
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
