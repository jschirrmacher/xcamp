module.exports = ({dgraphClient, dgraph, QueryFunction, store, rack, fetch, mailSender, mailChimp, templateGenerator, config, readModels}) => {
  const Model = {}

  Model.User = require('./user')(dgraphClient, QueryFunction, store)
  Model.Root = require('./root')(dgraphClient, dgraph, QueryFunction, store)
  Model.Topic = require('./topic')(dgraphClient, dgraph, QueryFunction, store)
  Model.Person = require('./person')(dgraphClient, dgraph, QueryFunction, Model.Topic, store, readModels)
  Model.Customer = require('./customer')(dgraphClient, dgraph, QueryFunction, rack, store)
  Model.Network = require('./network')(dgraphClient, dgraph, Model.Person, Model.Topic, store, readModels)
  Model.Invoice = require('./invoice')(dgraphClient, dgraph, store)
  Model.Payment = require('./payment')(dgraphClient, dgraph, Model, fetch, mailSender, store, config)
  Model.Ticket = require('./ticket')(dgraphClient, dgraph, Model.Customer, Model.Person, Model.Invoice, Model.Payment, QueryFunction, mailSender, templateGenerator, mailChimp, rack, store, config)

  return Model
}
