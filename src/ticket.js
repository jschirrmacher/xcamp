module.exports = (dgraphClient, dgraph, Customer, Person, Invoice, Payment, rack) => {
  async function buy(data, origin) {
    if (!data.tos_accepted) {
      return Promise.reject({status: 403, message: 'You need to accept the terms of service'})
    } else if (data.reduced && data.payment === 'invoice') {
      return Promise.reject({status: 403, message: 'Reduced tickets are available only when paying immediately'})
    }

    const txn = dgraphClient.newTxn()
    const customer = await Customer.create(txn, data)
    const invoice = await Invoice.create(txn, data, customer)
    txn.commit()
    const accountUrl = origin + '/accounts/' + customer.access_code
    return {
      isRedirection: true,
      url: invoice.payment ? accountUrl : Payment(origin).exec(customer, invoice, true)
    }
  }

  return {buy}
}
