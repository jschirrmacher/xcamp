module.exports = function diff(a, b) {
  return Object.keys(b).reduce((diff, key) => b[key] === a[key] ? diff : {...diff, [key]: b[key]}, {})
}
