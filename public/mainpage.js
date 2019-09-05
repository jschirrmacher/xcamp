fetch('/posts')
  .then(response => response.json())
  .then(blogData => blogData.map(prepareBlogEntryData))
  .then(blogData => blogData.map(generateBlogEntryView).join('\n'))
  .then(blog => document.querySelector('#newest-blog-entries .three-boxes').innerHTML = blog)

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
  el.innerHTML = entry.content
  return {
    img: entry.img,
    title: entry.title,
    link: entry.link,
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
