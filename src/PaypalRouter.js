module.exports = ({express, makeHandler, Model}) => {
  const router = express.Router()

  router.get('/', (req, res) => res.redirect('/accounts/my', 303))
  router.post('/', makeHandler(Model.Payment.paypalIpn, {type: 'send'}))

  return router
}
