fetch('http://xcamp.autentity.net/wp-json/wp/v2/posts?per_page=3&categories=28')
  .then(response => response.json())
  .then(blogData => {
    const ids = blogData.map(entry => entry.featured_media)
    return fetch('http://xcamp.autentity.net/wp-json/wp/v2/media?include=' + ids.join(','))
      .then(response => response.json())
      .then(media => {
        blogData.forEach((entry, index) => entry.img = prepareLink(media[index].guid.rendered))
        return blogData
      })
  })
  .then(blogData => blogData.map(prepareBlogEntryData))
  .then(blogData => blogData.map(generateBlogEntryView).join('\n'))
  .then(blog => document.querySelector('#newest-blog-entries .three-boxes').innerHTML = blog)

function prepareLink(url) {
  return url.replace('autentity.net', 'co').replace(/^http:/, 'https:')
}

function shorten(str) {
  if (str.length < 300) {
    return str
  } else {
    const rawShortened = str.substr(0, 300)
    return rawShortened.substr(0, rawShortened.lastIndexOf(' ')) + ' [&hellip;]'
  }
}

function prepareBlogEntryData(entry) {
  const el = document.createElement('div')
  el.innerHTML = entry.content.rendered
  return {
    img: entry.img,
    title: entry.title.rendered,
    link: prepareLink(entry.link),
    content: shorten(el.innerText.trim())
  }
}

function generateBlogEntryView(entry) {
  return `
            <div>
                <a href=${entry.link}>
                    <div class="img" style="background-image: url(${entry.img})"></div>
                    <p class="box">${entry.title}</p>
                </a>
                <p class="box">${entry.content}</p>
            </div>`
}

setMenuState()
document.querySelector('.main-menu .menu-item:first-of-type').classList.add('selected')
