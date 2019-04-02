const path = require('path')
const multer = require('multer')
const upload = multer({dest: path.resolve(__dirname , '..', 'profile-pictures')})

module.exports = (dependencies) => {
  const {
    express,
    auth,
    makeHandler,
    Person
  } = dependencies


  const router = express.Router()
  const allowAnonymous = true

  router.post('/', auth.requireJWT(), makeHandler(req => Person.upsert(req.txn, {}, req.body, req.user), {commit: true}))
  router.get('/:uid', auth.requireJWT({allowAnonymous}), makeHandler(req => Person.getPublicDetails(req.txn, req.params.uid, req.user), {txn: true}))
  router.put('/:uid', auth.requireJWT(), makeHandler(req => Person.updateById(req.txn, req.params.uid, req.body, req.user), {commit: true}))
  router.put('/:uid/picture', auth.requireJWT(), upload.single('picture'), makeHandler(req => Person.uploadProfilePicture(req.txn, req.params.uid, req.file, req.user), {commit: true}))
  router.get('/:uid/picture/:name', makeHandler(req => Person.getProfilePicture(req.txn, req.params.uid), {type: 'send', txn: true}))

  return router
}
