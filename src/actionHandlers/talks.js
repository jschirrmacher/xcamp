talkInfoReceiver = 'j.schirrmacher@justso.de'

module.exports = function ({logger, mailSender}) {
  return {
    handleEvent(event, type) {
      if (type === 'new') {
        try {
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
        } catch (error) {
          logger.error(error)
        }
      }
    }
  }
}
