const fs = require('fs')

module.exports = function ({store, config}) {
  const models = {}

  fs.readdirSync(__dirname)
    .map(name => name.replace('.js', ''))
    .filter(name => !name.endsWith('.test'))
    .filter(name => name !== 'index')
    .forEach(requireReader)

  store.replay()

  return models

  function requireReader(name) {
    if (!models[name]) {
      const model = require('./' + name)({models, store, config})
      if (model.dependencies) {
        model.dependencies.forEach(requireReader)
      }
      store.listen(model.handleEvent)
      models[name] = model
    }
  }
}
