const fs = require('fs')
const path = require('path')
const {Feed} = require('feed')

module.exports = ({express, templateGenerator, contentReader, nocache}) => {
  function generateFeed(req, res) {
    const feed = new Feed({
      title: config.eventName,
      description: config.title,
      id: config.baseUrl,
      link: config.baseUrl,
      language: "de",
      image: config.baseUrl + 'assets/img/xcamp.png',
      favicon: config.baseUrl + "favicon.ico",
      copyright: "XCamp",
      author: {
        name: "Joachim Schirrmacher",
        email: "joachim.schirrmacher@gmail.com",
        link: "https://github.com/jschirrmacher"
      }
    })

    contentReader.getPages('blog').forEach(page => {
      feed.addItem({
        title: page.meta.title,
        id: config.baseUrl + page.meta.pageName,
        link: config.baseUrl + page.meta.pageName,
        description: page.excerpt,
        content: page.html,
        author: {
          name: page.meta.author,
          link: config.baseUrl + 'team/' + page.meta.authorPage
        },
        date: new Date(page.meta.published),
        image: page.meta.image
      })
    })

    feed.addCategory(config.eventName)

    res.header('content-type', 'text/xml').send(feed.rss2())
  }

  const router = express.Router()

  router.get('/feed', nocache, generateFeed)
  router.get('/*', async (req, res, next) => {
    const fileName = path.join(contentReader.contentPath, req.path)
    if (fs.existsSync(fileName + '.md')) {
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
