select('#orga-coupon').addEventListener('click', () => {
  fetch('orga/coupon', {method: 'POST'})
    .then(result => result.json())
    .then(content => alert(content.link))
    .catch(error => alert(JSON.stringify(error)))
  return false
})
