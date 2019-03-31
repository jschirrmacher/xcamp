const path = require('path')
const multer = require('multer')
const upload = multer({dest: path.resolve(__dirname , '..', 'profile-pictures')})

module.exports = (dependencies) => {
  const {
    express,
    auth,
    doInTransaction,
    makeHandler,
    Person
  } = dependencies


  const router = express.Router()
  const allowAnonymous = true

  router.post('/', auth.requireJWT(), makeHandler(req => doInTransaction(Person.upsert, [{}, req.body, req.user], true)))
  router.get('/:uid', auth.requireJWT({allowAnonymous}), makeHandler(req => doInTransaction(Person.getPublicDetails, [req.params.uid, req.user])))
  router.put('/:uid', auth.requireJWT(), makeHandler(req => doInTransaction(Person.updateById, [req.params.uid, req.body, req.user], true)))
  router.put('/:uid/picture', auth.requireJWT(), upload.single('picture'), makeHandler(req => doInTransaction(Person.uploadProfilePicture, [req.params.uid, req.file, req.user], true)))
  router.get('/:uid/picture/:name', makeHandler(req => doInTransaction(Person.getProfilePicture, req.params.uid), 'send'))

  return router
}
