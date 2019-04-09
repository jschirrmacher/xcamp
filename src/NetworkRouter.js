const path = require('path')
const multer = require('multer')
const upload = multer({dest: path.resolve(__dirname , '..', 'profile-pictures')})

module.exports = (dependencies) => {
  const {
    express,
    auth,
    makeHandler,
    Model
  } = dependencies


  const router = express.Router()
  const allowAnonymous = true

  router.get('/', auth.requireJWT({allowAnonymous}), makeHandler(req => Model.Network.getGraph(req.query.what, req.user)))
  router.delete('/', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => Model.Network.rebuild()))

  router.put('/roots/:uid', auth.requireJWT(), auth.requireAdmin(), makeHandler(req => Model.Root.updateById(req.txn, req.params.uid, req.body, req.user), {commit: true}))

  router.get('/topics', makeHandler(req => Model.Topic.find(req.txn, req.query.q), {txn: true}))
  router.put('/topics/:uid', auth.requireJWT(), makeHandler(req => Model.Topic.updateById(req.txn, req.params.uid, req.body, req.user), {commit: true}))

  router.post('/persons', auth.requireJWT(), makeHandler(req => Model.Person.upsert(req.txn, {}, req.body, req.user), {commit: true}))
  router.get('/persons/:uid', auth.requireJWT({allowAnonymous}), makeHandler(req => Model.Person.getPublicDetails(req.txn, req.params.uid, req.user), {txn: true}))
  router.put('/persons/:uid', auth.requireJWT(), makeHandler(req => Model.Person.updateById(req.txn, req.params.uid, req.body, req.user), {commit: true}))
  router.put('/persons/:uid/picture', auth.requireJWT(), upload.single('picture'), makeHandler(req => Model.Person.uploadProfilePicture(req.txn, req.params.uid, req.file, req.user), {commit: true}))
  router.get('/persons/:uid/picture/:name', makeHandler(req => Model.Person.getProfilePicture(req.txn, req.params.uid), {type: 'send', txn: true}))

  return router
}
