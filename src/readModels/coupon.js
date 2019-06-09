module.exports = function () {
  const coupons = {}

  return {
    handleEvent(event, assert) {
      if (event.type === 'coupon-created') {
        assert(event.access_code, 'Missing access_code')
        const category = event.category || 'reduced'
        const validTill = new Date((new Date(event.ts)).getTime() + 28 * 86400 * 1000)
        coupons[event.access_code] = {category, generated_by: event.generated_by, validTill}
      } else if (event.type === 'coupon-invalidated') {
        assert(event.code, 'Missing code')
        delete coupons[event.code]
      }
    },

    getAll() {
      return coupons
    },

    getByAccessCode(code) {
      if (coupons[code] && coupons[code].validTill >= new Date()) {
        return coupons[code]
      }
      return null
    }
  }
}
