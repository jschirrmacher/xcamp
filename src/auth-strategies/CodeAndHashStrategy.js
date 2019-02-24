const passport = require('passport')

module.exports = class CodeAndHashStrategy extends passport.Strategy {
  constructor(verify) {
    super(verify)
    this.name = 'codeNHash'
    this.verify = verify
  }

  authenticate(req) {
    if (!req.params.accessCode || !req.params.hash) {
      this.fail('access code or hash not provided')
    } else {
      this.verify(req.params.accessCode, req.params.hash, (err, info) => err ? this.fail(err) : this.success(info))
    }
  }
}
