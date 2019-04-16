const actionHandlers = ['talks']

module.exports = function({store, logger, mailSender}) {
  const handlers = Object.assign({}, ...actionHandlers.map(name => {
    return {[name]: require('./' + name)({logger, mailSender})}
  }))

  Object.values(handlers).forEach(handler => store.listen(handler.handleEvent))

  return handlers
}
