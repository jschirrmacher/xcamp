module.exports = function ({ config }) {
  const RocketChat = require('./RocketChatAdapter')({ config })

  return {
    RocketChat
  }
}
