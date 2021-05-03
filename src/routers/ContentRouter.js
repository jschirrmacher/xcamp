const fs = require('fs')
const path = require('path')

module.exports = ({express, templateGenerator, contentReader}) => {
  const router = express.Router()

  router.get('/*', async (req, res, next) => {
    const fileName = path.join(contentReader.contentPath, req.path)
    if (fs.existsSync(fileName)) {
      res.sendFile(fileName)
    } else if (fs.existsSync(fileName + '.md')) {
      const {meta, html} = contentReader.getPageContent(req.path)
      const articleList = contentReader.getPages('blog')
        .filter(article => article.meta.author === meta.title)
      res.send(templateGenerator.generate(meta.layout, {html, meta, articleList}))
    } else if (fs.existsSync(fileName)) {
      res.sendFile(fileName)
    } else {
      next()
    }
  })

  return router
}
