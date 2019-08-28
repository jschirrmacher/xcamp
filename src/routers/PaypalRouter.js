module.exports = ({express, makeHandler, Payment}) => {
  const router = express.Router()

  router.get('/', (req, res) => res.redirect('/accounts/my', 303))
  router.post('/', makeHandler(Payment.paypalIpn, {type: 'send'}))

  return router
}
