const config = require('../config/config')

module.exports = ticketTypes = {
  orga:      {name: 'Organizer', price: 0},
  speaker:   {name: 'Speaker', price: 0},
  sponsor:   {name: 'Sponsor', price: 0},
  corporate: {name: 'Unternehmen', price: config.ticketCategories.corporate},
  private:   {name: 'Selbstzahler', price: config.ticketCategories.private},
  reduced:   {name: 'Reduziert', price: config.ticketCategories.reduced, restricted: true}
}
