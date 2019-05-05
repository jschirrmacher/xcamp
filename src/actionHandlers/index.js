const fs = require('fs')

module.exports = function({store, mailSender}) {
  const handlers = {}

  fs.readdirSync(__dirname)
    .map(name => name.replace('.js', ''))
    .filter(name => name !== 'index')
    .forEach(name => handlers[name] = require('./' + name)({mailSender}))

  Object.values(handlers).forEach(handler => store.listen(handler.handleEvent))

  return handlers
}
