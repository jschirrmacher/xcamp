module.exports = ({auth, templateGenerator, logger}) => {
  return function makeHandler(func, options = {}) {
    const {type = 'json'} = options
    return async function (req, res, next) {
      try {
        const result = await func(req)
        if (result && result.isRedirection) {
          if (result.user) {
            auth.signIn({user: result.user}, res)
          }
          res.redirect(result.url)
        } else if (result && result.mimeType) {
          res.contentType(result.mimeType)
          if (result.disposition) {
            const name = result.name ? '; filename="' + result.name + '"' : ''
            res.header('Content-Disposition', result.disposition + encodeURIComponent(name))
          }
          res.send(result.content)
        } else {
          res[type](result)
        }
      } catch (error) {
        const template = error.template || 'exception-occured'
        const params = error.params || {message: error.message || error.toString()}
        res
          .status(error.status || 500)
          .send(templateGenerator.generate(template, params))
        next(error)
      }
    }
  }
}
