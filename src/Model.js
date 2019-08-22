module.exports = ({store, rack, mailSender, Payment, mailChimp, templateGenerator, config, readModels}) => {
  const Model = {}

  Model.Person = require('./person')(store, readModels, rack)
  Model.Customer = require('./customer')(store, readModels)
  Model.Invoice = require('./invoice')(store, readModels, config, rack)
  Model.Ticket = require('./ticket')(Model, mailSender, templateGenerator, Payment, mailChimp, rack, store, readModels, config)

  return Model
}
