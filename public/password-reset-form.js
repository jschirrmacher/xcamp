document.getElementById('chgPwdForm').addEventListener('submit', function (event) {
  event.preventDefault()
  const token = document.cookie.match(new RegExp('(^| )token=([^;]+)'))
  const authorization = token ? token[2] : null
  const headers = {'content-type': 'application/json', authorization}
  const password = document.getElementById('password').value
  fetch('accounts/password', {method: 'POST', headers, body: JSON.stringify({password})})
    .then(result => result.json())
    .then(({message, userId}) => showMessage(message) || userId)
    .catch(error => console.error(error) || '')
    .then(id => location.href = document.head.baseURI + '#' + id)
  return false;
})
