const passport = require('passport')

module.exports = class LoginStrategy extends passport.Strategy {
  constructor(verify) {
    super(verify)
    this.name = 'login'
    this.verify = verify
  }

  authenticate(req) {
    const body = req.body
    if (!(body.email || body.username) && !body.password) {
      this.fail('no credentials provided')
    } else {
      this.verify(body.email, body.username, body.password, (err, info) => err ? this.fail(err) : this.success(info))
    }
  }
}
