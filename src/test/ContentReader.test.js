require('should')
const ContentReader = require('../ContentReader')

const reader = ContentReader({logger: console, config: {basePath: __dirname}})

describe('ContentReader', () => {
  it('should return meta information', () => {
    const {meta} = reader.getPageContent('test-page', 'blog', '_posts')
    meta.should.containDeep({title: 'Test page', layout: 'test-layout'})
  })

  it('should render blog page content', () => {
    const {html} = reader.getPageContent('test-page', 'blog', '_posts')
    html.should.match(/<p>Content of test page<\/p>/)
  })

  it('should resolve internal links correctly', () => {
    const {html} = reader.getPageContent('test-page', 'blog', '_posts')
    html.should.match(/a href="blog\/test-page#anchor"/)
  })
})
