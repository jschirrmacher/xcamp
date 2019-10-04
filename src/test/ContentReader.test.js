require('should')
const ContentReader = require('../ContentReader')

const reader = ContentReader({logger: console, config: {basePath: __dirname}})

describe('ContentReader', () => {
  describe('getPages()', () => {
    it('should return a list of pages in the given folder', () => {
      const pages = reader.getPages('blog')
      pages.should.be.an.array
      pages.length.should.equal(1)
      pages[0].meta.title.should.equal('Test page')
    })

    it('should not return other pages', () => {
      const pages = reader.getPages('team')
      pages.map(p => p.meta.title).should.not.containDeep('Test page')
    })
  })

  describe('getPageContent()', () => {
    it('should return meta information', () => {
      const {meta} = reader.getPageContent('blog/test-page')
      meta.should.containDeep({title: 'Test page', layout: 'test-layout'})
    })

    it('should render blog page content', () => {
      const {html} = reader.getPageContent('blog/test-page')
      html.should.match(/<p>Content of test page<\/p>/)
    })

    it('should resolve internal links correctly', () => {
      const {html} = reader.getPageContent('blog/test-page')
      html.should.match(/<a href="blog\/test-page#anchor">/)
    })

    it('should resolve local images', () => {
      const {html} = reader.getPageContent('blog/test-page')
      html.should.match(/<img src="blog\/media\/image.jpg" alt="local image"/)
    })

    it('should resolve remote images', () => {
      const {html} = reader.getPageContent('blog/test-page')
      html.should.match(/<img src="http:\/\/example.com\/image.jpg" alt="image with absolute path"/)
    })

    it('should add the dirname to the meta image', () => {
      const {meta} = reader.getPageContent('blog/test-page')
      meta.image.should.equal('blog/media/image.jpg')
    })

    it('should handle images in root pages correctly', () => {
      const {html} = reader.getPageContent('/other-page')
      html.should.match(/<img src="team\/member.jpg" alt="member image"/)
    })
  })

  after(() => {
    reader.stop()
  })
})
