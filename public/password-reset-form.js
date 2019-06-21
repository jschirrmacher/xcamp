document.body.classList.toggle('logged-in', true)
document.body.classList.toggle('logged-out', false)

document.getElementById('chgPwdForm').addEventListener('submit', function (event) {
  event.preventDefault()
  const token = document.cookie.match(new RegExp('(^| )token=([^;]+)'))
  const authorization = token ? token[2] : null
  const headers = {'content-type': 'application/json', authorization}
  const password = document.getElementById('password').value
  fetch('accounts/password', {method: 'POST', headers, body: JSON.stringify({password})})
    .then(result => result.json())
    .then(({message, url}) => url ? (location.href = url) : showMessage(message))
    .catch(error => console.error(error) || '')
  return false;
})
