module.exports = ({dgraphClient, dgraph, QueryFunction, store, rack, mailSender, Payment, mailChimp, templateGenerator, config, readModels}) => {
  const Model = {}

  Model.Person = require('./person')(store, readModels)
  Model.Customer = require('./customer')(dgraphClient, dgraph, QueryFunction, rack, store, readModels)
  Model.Invoice = require('./invoice')(store, readModels, config, rack)
  Model.Ticket = require('./ticket')(dgraphClient, Model, mailSender, templateGenerator, Payment, mailChimp, rack, store, readModels, config)

  return Model
}
