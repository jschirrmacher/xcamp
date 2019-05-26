const config = require('../config/config')

module.exports = ticketTypes = {
  orga:      {name: 'Organizer', price: 0},
  speaker:   {name: 'Speaker', price: 0},
  sponsor:   {name: 'Sponsor', price: 0},
  corporate: {name: 'Unternehmen', price: config.ticketCategories.corporate},
  earlybird: {name: 'Early Bird', price: config.ticketCategories.earlybird, restricted: true},
  private:   {name: 'Selbstzahler', price: config.ticketCategories.private},
  lastminute:{name: 'Last Minute', price: config.ticketCategories.lastminute},
  reduced:   {name: 'Reduziert', price: config.ticketCategories.reduced, restricted: true}
}
