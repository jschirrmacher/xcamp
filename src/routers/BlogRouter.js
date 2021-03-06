const fs = require('fs')
const path = require('path')

const pageSize = 10

module.exports = ({express, makeHandler, templateGenerator, config, contentReader}) => {
  function showList(pageNo) {
    const pages = contentReader.getPages('blog')
    const startEntryNo = (pageNo - 1) * pageSize
    const entries = pages.slice(startEntryNo, startEntryNo + pageSize)
    const maxPage = Math.ceil(pages.length / pageSize)
    const pageNums = Array.from({length: maxPage}, (_, i) => ({
      page: i + 1,
      active: i + 1 === pageNo ? 'active' : undefined
    }))
    const prevPage = pageNo > 1 ? pageNo - 1 : false
    const nextPage = pageNo < maxPage ? pageNo + 1 : false

    return templateGenerator.generate('blog-list', {entries, pageNums, pageNo, prevPage, nextPage})
  }

  function showPage(name) {
    const files = contentReader.getPages('blog')
    const index = files.findIndex(e => e.meta.pageName === name)
    if (index < 0) {
      throw {next: true}
    } else {
      const {html, meta} = contentReader.getPageContent(name)
      const prevPage = index > 0 ? files[index - 1].meta.pageName : false
      const nextPage = index < files.length - 1 ? files[index + 1].meta.pageName : false
      const selflink = config.baseUrl + name
      const facebook = 'https://www.facebook.com/sharer.php?u=' + encodeURIComponent(selflink)
      const twitter = 'https://twitter.com/share?url=' + encodeURIComponent(selflink) + '&text=' + encodeURIComponent(meta.title)
      const otherEntries = getNumPosts(5, name)
      const hasOthers = otherEntries.length
      const authorPage = meta.authorPage && contentReader.getPageContent('team/' + meta.authorPage)
      const author = {
        image: authorPage && authorPage.meta.image || 'assets/img/user.png',
        name: authorPage && authorPage.meta.title || meta.author,
        html: authorPage && authorPage.html || ''
      }
      return templateGenerator.generate('post', {text: html, ...meta, prevPage, nextPage, hasOthers, otherEntries, facebook, twitter, author, selflink})
    }
  }

  function getNumPosts(num = 3, exclude = null, tag = null) {
    return contentReader.getPages('blog')
      .filter(page => !tag || page.meta.tags.split(',').map(t => t.trim().toLowerCase()).includes(tag.toLowerCase()))
      .filter(page => page.meta.pageName !== exclude)
      .slice(0, num)
      .map(page => {
        return {
          img: page.meta.image,
          link: page.meta.pageName,
          title: page.meta.title,
          content: page.excerpt,
        }
      })
  }

  const router = express.Router()

  router.get('/', makeHandler(req => showList(+req.query.page || 1), {type: 'send'}))
  router.get('/:pageName', makeHandler(req => showPage('blog/' + req.params.pageName), {type: 'send'}))
  router.get('/articles', makeHandler(req => getNumPosts(req.query.num || 3, null, req.query.tag)))
  router.get('/media/*', (req, res, next) => {
    const fileName = path.resolve(contentReader.contentPath, req.path.replace(/^\//, ''))
    if (fs.existsSync(fileName)) {
      res.sendFile(fileName)
    } else {
      next()
    }
  })

  return router
}
