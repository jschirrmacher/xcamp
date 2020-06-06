fetch('blog/articles?num=3&tag=' + encodeURIComponent(location.pathname.replace(/.*\//, '')))
  .then(response => response.json())
  .then(blogData => blogData.map(generateBlogEntryView).join('\n'))
  .then(blog => document.querySelector('#newest-blog-entries').innerHTML = blog)

function generateBlogEntryView(entry) {
  return `
      <li>
          <a href="${entry.link}">
              <div class="img" style="background-image: url(${entry.img})"></div>
              <p class="box">${entry.title}</p>
          </a>
          <div class="box">${entry.content}</div>
      </li>`
}

setMenuState()
document.querySelector('.main-menu .menu-item:first-of-type').classList.add('selected')
