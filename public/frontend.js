/* global d3*/

const gravityStrength = 0.1
const collisionRadius = 100

const popup = document.querySelector('.popup')
const chatFrame = document.querySelector('#chat iframe')
const wikiFrame = document.querySelector('#wiki iframe')

chatFrame.addEventListener('load', () => {
  document.body.classList.add('ready')
})
chatFrame.setAttribute('src', 'https://community.xcamp.co/home?layout=embedded')

function showDetails(node) {
  document.querySelector('#chat .title').innerText = 'Gespräch ' + (node.type === 'person' ? 'mit' : 'über') + ' ' + node.name
  chatFrame.contentWindow.postMessage({ externalCommand: 'go', path: node.channel }, '*')
  wikiFrame.src = 'https://wiki.xcamp.co' + node.channel.replace('channel/', '').replace('direct/', 'user/')
  popup.classList.add('open')
}

document.querySelector('.popup .close').addEventListener('click', () => popup.classList.remove('open'))
window.addEventListener('message', function (e) {
  console.log(e.data.eventName, e.data.data)
})

document.querySelectorAll('.nav-link').forEach(el => {
  el.pane = document.querySelector(el.getAttribute('href'))
  el.addEventListener('click', event => {
    const current = Array.from(event.target.parentNode.children).find(el => el.classList.contains('active'))
    if (current) {
      current.pane.classList.remove('active')
      current.pane.classList.remove('show')
      current.classList.remove('active')
    }
    event.target.pane.classList.add('active')
    event.target.pane.classList.add('show')
    event.target.classList.add('active')
  })
})

d3.json('/network', (error, graph) => {
  if (error) {
    throw error
  }

  let activeNode

  const simulation = d3.forceSimulation(graph.nodes)
    .force('link', d3.forceLink().id(function (d) { return d.id }))
    .force('charge', d3.forceManyBody())
    .force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
    .force('gravityX', d3.forceX(window.innerWidth / 2).strength(gravityStrength))
    .force('gravityY', d3.forceY(window.innerHeight / 2).strength(gravityStrength))
    .force('collision', d3.forceCollide(collisionRadius))
    .alphaDecay(0.1)

  const allNodes = d3.select('#root')
    .selectAll('.node')
    .data(graph.nodes)

  const node = allNodes.enter()
    .append('div')
    .attr('class', d => 'node node-' + d.type)
    .classed('active', d => activeNode && d.id === activeNode.id)
    .merge(allNodes)
    .on('click', activate)
  
  allNodes.exit().remove()

  const persons = d3.select('#root').selectAll('.node-person')
  persons.append('img')
    .attr('src', d => d.image || 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==')

  node.append('h2')
    .text(d => d.name)

  node.append('div')
    .attr('class', 'details')
    .text(d => d.details)

  node.append('div')
    .attr('class', 'chat')
    .on('click', d => showDetails(d))

  update()

  function update() {
    node.classed('active', d => activeNode && d.id === activeNode.id)

    const links = graph.nodes
      .map(node => Object.values(node.links).flat().map(other => ({
        source: node,
        target: graph.nodes.find(n => n.id === other)
      })))
      .flat()

    const filteredLinks = links.filter(l => activeNode && (l.source.id === activeNode.id || l.target.id === activeNode.id))
    const allLinks = d3.select('#root')
      .selectAll('.link')
      .data(filteredLinks)

    const link = allLinks.enter()
      .append('div')
      .attr('class', 'link')
      .merge(allLinks)
    allLinks.exit().remove()

    simulation
      .force('collision', d3.forceCollide(d => (activeNode && d.id === activeNode.id) ? 250 : collisionRadius))
      .force('x', d3.forceX().strength(forceStrength).x(window.innerWidth / 2))
      .force('y', d3.forceY().strength(forceStrength).y(window.innerHeight / 2))
      .force('link', d3.forceLink().links(filteredLinks))
      .on('tick', ticked)
      .alpha(1).restart()

    function forceStrength(d) {
      return d.id === activate ? 10 : 0.1
    }

    function ticked() {
      link.attr('style', d => {
        const dx = d.target.x - d.source.x
        const dy = d.target.y - d.source.y
        var length = Math.sqrt(dx * dx + dy * dy)
        var angle  = Math.atan2(dy, dx) * 180 / Math.PI
        return 'left: ' + d.source.x + 'px; top: ' + d.source.y + 'px; width: ' + length + 'px; transform: rotate(' + angle + 'deg)'
      })
      node.attr('style', d => {
        const width = activeNode && d.id === activeNode.id ? 320 : 100
        const height = activeNode && d.id === activeNode.id ? 320 : 100
        return 'left: ' + Math.round(d.x - width / 2) + 'px; top: ' + Math.round(d.y - height / 2) + 'px;'
      })
    }
  }
  
  function activate() {
    if (activeNode) {
      activeNode.fx = undefined
      activeNode.fy = undefined
    }
    activeNode = this.__data__
    activeNode.fx = window.innerWidth / 2
    activeNode.fy = window.innerHeight / 2

    update()
  }
})
