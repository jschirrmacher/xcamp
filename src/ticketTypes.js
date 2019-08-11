
module.exports = function (config) {
  return {
    orga:      {category: 'free', name: 'Organizer', price: 0},
    speaker:   {category: 'free', name: 'Speaker', price: 0},
    sponsor:   {category: 'free', name: 'Sponsor', price: 0},
    corporate: {category: 'corporate', name: 'Unternehmen', price: config.ticketCategories.corporate},
    earlybird: {category: 'private', name: 'Early Bird', price: config.ticketCategories.earlybird, restricted: true},
    private:   {category: 'private', name: 'Selbstzahler', price: config.ticketCategories.private},
    lastminute:{category: 'private', name: 'Last Minute', price: config.ticketCategories.lastminute},
    reduced:   {category: 'reduced', name: 'Reduziert', price: config.ticketCategories.reduced, restricted: true}
  }
}
