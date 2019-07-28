module.exports = ({dgraphClient, dgraph, QueryFunction, store, rack, mailSender, Payment, mailChimp, templateGenerator, config, readModels}) => {
  const Model = {}

  Model.Root = require('./root')(dgraphClient, dgraph, QueryFunction, store)
  Model.Topic = require('./topic')(dgraphClient, dgraph, QueryFunction, store)
  Model.Person = require('./person')(dgraphClient, dgraph, QueryFunction, Model, store, readModels)
  Model.Customer = require('./customer')(dgraphClient, dgraph, QueryFunction, rack, store)
  Model.Network = require('./network')(dgraphClient, dgraph, store, readModels)
  Model.Invoice = require('./invoice')(store, readModels)
  Model.Ticket = require('./ticket')(dgraphClient, dgraph, Model, QueryFunction, mailSender, templateGenerator, Payment, mailChimp, rack, store, readModels, config)

  return Model
}
