select('#orga-coupon').addEventListener('click', () => {
  fetch('orga/coupon/reduced', {method: 'POST'})
    .then(result => result.json())
    .then(content => showMessage('Bitte folgenden Link kopieren und versenden:\n\n' + content.link))
    .catch(error => showMessage(JSON.stringify(error)))
  return false
})

select('#orga-coupon-earlybird').addEventListener('click', () => {
  fetch('orga/coupon/earlybird', {method: 'POST'})
    .then(result => result.json())
    .then(content => showMessage('Bitte folgenden Link kopieren und versenden:\n\n' + content.link))
    .catch(error => showMessage(JSON.stringify(error)))
  return false
})

setMenuState()
