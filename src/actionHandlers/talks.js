const talkInfoReceiver = 'j.schirrmacher@justso.de'

module.exports = function ({mailSender}) {
  return {
    handleEvent(event, assert, type) {
      if (type === 'new') {
        switch (event.type) {
          case 'talk-published':
            mailSender.send(
              talkInfoReceiver,
              'Talk veröffentlicht',
              `<p>${event.person.name} hat seinen/ihren Talk veröffentlicht</p>\n<p>\n${event.talk}</p>`
            )
            break

          case 'talk-withdrawn':
            mailSender.send(
              talkInfoReceiver,
              'Talk zurückgezogen',
              `${event.person.name} hat seinen/ihren Talk zurückgezogen`
            )
            break
        }
      }
    }
  }
}
