fetch('blog/lastthree')
  .then(response => response.json())
  .then(blogData => blogData.map(generateBlogEntryView).join('\n'))
  .then(blog => document.querySelector('#newest-blog-entries .three-boxes').innerHTML = blog)

function generateBlogEntryView(entry) {
  return `
            <div>
                <a href="blog/${entry.link}">
                    <div class="img" style="background-image: url(${entry.img})"></div>
                    <p class="box">${entry.title}</p>
                </a>
                <div class="box">${entry.content}</div>
            </div>`
}

setMenuState()
document.querySelector('.main-menu .menu-item:first-of-type').classList.add('selected')
