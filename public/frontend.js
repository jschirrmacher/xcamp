/* global d3*/

const gravityStrength = 0.2
const collisionRadius = 100

d3.json('/network', (error, graph) => {
  if (error) {
    throw error
  }

  let activeId
  let allNodes

  const simulation = d3.forceSimulation(graph.nodes)
    .force('link', d3.forceLink().id(function (d) { return d.id }))
    .force('charge', d3.forceManyBody())
    .force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
    .force('gravityX', d3.forceX(window.innerWidth / 2).strength(gravityStrength))
    .force('gravityY', d3.forceY(window.innerHeight / 2).strength(gravityStrength))
    .force('collision', d3.forceCollide(collisionRadius))
    .on('tick', ticked)

  //const links = graph.nodes.map(node => Object.values(node.links).map(l => ({source: node.id, dest: l}))).flat(2)
  // simulation.force('link')
  //  .links(links)

  allNodes = d3.select('#root')
    .selectAll('.node')
    .data(graph.nodes)

  const node = allNodes.enter()
    .append('div')
    .attr('class', d => 'node node-' + d.type)
    .classed('active', d => d.id === activeId)
    .merge(allNodes)
    .on('click', d => activate(d.id))
  
  allNodes.exit().remove()

  d3.select('#root').selectAll('.node-person')
    .append('img')
    .attr('src', d => d.image || 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==')

  node.append('span')
    .attr('class', 'title')
    .text(d => d.name)

  function ticked() {
    node.attr('style', d => {
      const width = d.id === activeId ? 320 : 100
      const height = d.id === activeId ? 320 : 100
      return 'left: ' + Math.round(d.x - width / 2) + 'px; top: ' + Math.round(d.y - height / 2) + 'px;'
    })
  }
  
  function activate(newId) {
    activeId = newId
    node.classed('active', d => d.id === newId)
    simulation
      .force('collision', d3.forceCollide(d => d.id === activeId ? 250 : collisionRadius))
      .force('x', d3.forceX().strength(forceStrength).x(window.innerWidth / 2))
      .force('y', d3.forceY().strength(forceStrength).y(window.innerHeight / 2))
    simulation.alpha(1).restart()
  }

  function forceStrength(d) {
    return d.id === activate ? 1 : 0.1
  }
})
