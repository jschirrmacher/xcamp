select('#orga-coupon').addEventListener('click', () => {
  fetch('orga/coupon', {method: 'POST'})
    .then(result => result.json())
    .then(content => showMessage('Bitte folgenden Link kopieren und versenden:\n\n' + content.link))
    .catch(error => showMessage(JSON.stringify(error)))
  return false
})

document.body.classList.add('logged-in')
