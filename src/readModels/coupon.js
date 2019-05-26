module.exports = function () {
  const coupons = {}

  return {
    handleEvent(event, assert) {
      switch (event.type) {
        case 'coupon-created':
          const category = event.category || 'reduced'
          const validTill = new Date((new Date(event.ts)).getTime() + 28 * 86400 * 1000)
          coupons[event.access_code] = {category, generated_by: event.generated_by, validTill}
          break

        case 'coupon-invalidated':
          delete coupons[event.code]
          break
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
