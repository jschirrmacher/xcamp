const readModels = ['user', 'person', 'talks']

module.exports = function({store, logger}) {
  const models = Object.assign({}, ...readModels.map(name => {
    return {[name]: require('./' + name)({logger})}
  }))

  Object.values(models).forEach(model => store.listen(model.handleEvent))

  return models
}
