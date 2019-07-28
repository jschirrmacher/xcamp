const fs = require('fs')

module.exports = function({store}) {
  const models = {}

  fs.readdirSync(__dirname)
    .map(name => name.replace('.js', ''))
    .filter(name => !name.endsWith('.test'))
    .filter(name => name !== 'index')
    .forEach(name => models[name] = require('./' + name)({models, store}))

  Object.values(models).forEach(model => store.listen(model.handleEvent))
  store.replay()

  return models
}
