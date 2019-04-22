module.exports = function(add) {
  const objects = {}

  function diff(a, b) {
    return Object.keys(b).reduce((diff, key) => b[key] === a[key] ? diff : {...diff, [key]: b[key]}, {})
  }

  return function (event) {
    switch (event.type) {
      case 'person-updated':
      case 'root-updated':
      case 'topic-updated':
        const type = event.type.replace('-updated', '')
        const changed = event[type]
        const object = objects[changed.id]
        if (object) {
          const delta = diff(object, changed)
          objects[changed.id] = {...object, ...delta}
          add({type: event.type, ts: event.ts, [type]: {id: changed.id, ...delta}})
        } else {
          objects[changed.id] = changed
          add(event)
        }
        break

      default:
        add(event)
    }
  }
}
