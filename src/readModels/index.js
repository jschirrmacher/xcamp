const readModels = ['user']

module.exports = function(store) {
  const models = Object.assign({}, ...readModels.map(model => ({[model]: require('./' + model)})))

  store.listen(event => Object.values(models).forEach(model => model.handleEvent(event)))

  return models
}
