module.exports = ({express, makeHandler, Model}) => {
  const router = express.Router()

  router.get('/paypal/ipn', (req, res) => res.redirect('/accounts/my', 303))
  router.post('/paypal/ipn', makeHandler(Model.Payment.paypalIpn, {type: 'send'}))

  return router
}
