module.exports = {
  leadingZero(num) {
    return ('0' + num).substr(-2)
  },

  date(date) {
    if (!date) {
      return ''
    }

    return this.leadingZero(date.getDate()) + '.' + this.leadingZero(date.getMonth()+1) + '.' + date.getFullYear()
  },

  currency(n, currencySymbol = '€') {
    const integralPart = ('' + Math.floor(n)).replace(/(\d)(?=(\d{3})+)/g, '$1.')
    const fractionalPart = this.leadingZero(n.toFixed(2).slice(2))
    return integralPart + ',' + fractionalPart + ' ' + currencySymbol
  }
}
