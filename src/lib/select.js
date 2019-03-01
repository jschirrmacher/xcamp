module.exports = function select(object, fields) {
  return Object.assign({}, ...fields.map(field => ({[field]: object[field]})))
}
