module.exports = ({dgraphClient, dgraph, QueryFunction, store, rack, fetch, mailSender, mailChimp, templateGenerator, config}) => {
  const User = require('./user')(dgraphClient, QueryFunction, store)
  const Root = require('./root')(dgraphClient, dgraph, QueryFunction, store)
  const Topic = require('./topic')(dgraphClient, dgraph, QueryFunction, store)
  const Person = require('./person')(dgraphClient, dgraph, QueryFunction, Topic, store)
  const Customer = require('./customer')(dgraphClient, dgraph, QueryFunction, rack, store)
  const Network = require('./network')(dgraphClient, dgraph, Person, Topic, store)
  const Invoice = require('./invoice')(dgraphClient, dgraph, store)
  const Payment = require('./payment')(dgraphClient, dgraph, Invoice, fetch, config.baseUrl, mailSender, !config.isProduction, store)
  const Ticket = require('./ticket')(dgraphClient, dgraph, Customer, Person, Invoice, Payment, QueryFunction, mailSender, templateGenerator, mailChimp, rack, store, config)

  return {User, Root, Topic, Person, Customer, Network, Invoice, Payment, Ticket}
}
