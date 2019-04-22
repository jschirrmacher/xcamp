module.exports = function(add) {
  return function (event) {
    const {ts, type, ...rest} = event
    add({ts, type, ...rest})
  }
}
