const {Feed} = require('feed')

module.exports = ({express, contentReader, config}) => {
  const router = express.Router()

  router.get('/', (req, res) => {
    const feed = new Feed({
      title: config.eventName,
      description: config.title,
      id: config.baseUrl,
      link: config.baseUrl,
      language: 'de',
      image: config.baseUrl + 'assets/img/xcamp.png',
      favicon: config.baseUrl + 'favicon.ico',
      copyright: 'XCamp',
      author: config.feed.author
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
  })

  return router
}
