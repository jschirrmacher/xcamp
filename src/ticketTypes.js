module.exports = ticketTypes = {
  orga:      {name: 'Organizer', price: 0},
  speaker:   {name: 'Speaker', price: 0},
  sponsor:   {name: 'Sponsor', price: 0},
  corporate: {name: 'Unternehmen', price: 250},
  private:   {name: 'Selbstzahler (Early Bird)', price: 75},
  reduced:   {name: 'Reduziert', price: 25, restricted: true}
}
