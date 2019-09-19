const fs = require('fs')
const path = require('path')

const pageSize = 10

module.exports = ({express, makeHandler, templateGenerator, config, contentReader}) => {
  function showAll(pageNo) {
    const pages = contentReader.getPages('blog')
    const startEntryNo = (pageNo - 1) * pageSize
    const relevantPages = pages.slice(startEntryNo, startEntryNo + pageSize)
    const maxPage = Math.ceil(pages.length / pageSize)
    const pageNums = Array.from({length: maxPage}, (_, i) => ({
      page: i + 1,
      active: i + 1 === pageNo ? 'active' : undefined
    }))
    const prevPage = pageNo > 1 ? pageNo - 1 : false
    const nextPage = pageNo < maxPage ? pageNo + 1 : false

    const entries = relevantPages
      .map(page => contentReader.getPageContent(page.meta.pageName, 'blog'))
    return templateGenerator.generate('blog-list', {entries, pageNums, pageNo, prevPage, nextPage})
  }

  function showPage(name) {
    const files = contentReader.getPages('blog')
    const index = files.findIndex(e => e.meta.pageName === name)
    if (index < 0) {
      const imageFileName = path.resolve(contentReader.contentPath, 'media', name)
      if (fs.existsSync(imageFileName)) {
        return {sendFile: imageFileName}
      } else {
        throw {next: true}
      }
    } else {
      const {html, meta} = contentReader.getPageContent(name, 'blog')
      const prevPage = index > 0 ? 'blog/' + files[index - 1].meta.pageName : false
      const nextPage = index < files.length - 1 ? 'blog/' + files[index + 1].meta.pageName : false
      const selflink = config.baseUrl + '/blog/' + name
      const facebook = 'https://www.facebook.com/sharer.php?u=' + encodeURIComponent(selflink)
      const twitter = 'https://twitter.com/share?url=' + encodeURIComponent(selflink) + '&text=' + encodeURIComponent(meta.title)
      const otherEntries = getNumPosts(5, name)
      const hasOthers = otherEntries.length
      return templateGenerator.generate('blog-entry', {text: html, ...meta, prevPage, nextPage, hasOthers, otherEntries, facebook, twitter})
    }
  }

  function getNumPosts(num = 3, exclude = null) {
    return contentReader.getPages('blog')
      .filter(page => page.meta.pageName !== exclude)
      .slice(0, num)
      .map(page => {
        return {
          img: page.meta.image,
          link: 'blog/' + page.meta.pageName,
          title: page.meta.title,
          content: page.previewText,
        }
      })
  }

  const router = express.Router()

  router.get('/', makeHandler(req => showAll(+req.query.page || 1), {type: 'send'}))
  router.get('/lastthree', makeHandler(() => getNumPosts(), {type: 'send'}))
  router.get('/:pageName', makeHandler(req => showPage(req.params.pageName), {type: 'send'}))

  return router
}
