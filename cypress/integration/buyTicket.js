const faker = require('faker')
faker.locale = 'de'

describe('Buying a ticket', function() {
  it('should work for corporate with invoice', function() {
    cy.visit('http://localhost:8001/tickets')
    const firstName = faker.name.firstName()
    const lastName = faker.name.lastName()
    cy.get('#payment-first-name').type(firstName)
    cy.get('#payment-name').type(lastName)
    cy.get('#payment-email').type(faker.internet.email())
    cy.get('#payment-address').type(faker.address.streetName())
    cy.get('#payment-post-code').type(faker.address.zipCode())
    cy.get('#payment-city').type(faker.address.city())

    cy.get('#payment-invoice').check()
    cy.get('#tos-accepted').check()
    cy.get('#submit-button').click()

    cy.contains('Mein XCamp Account')
    cy.contains('Hier ist deine Rechnung')
    cy.contains('Bitte überweise den Betrag innerhalb von')
  })

  it('should allow buying only if TOS are accepted', () => {
    cy.visit('http://localhost:8001/tickets')
    cy.get('#submit-button').should('be.disabled')
    cy.get('#tos-accepted').check()
    cy.get('#submit-button').should('not.be.disabled')
  })

  it('should only allow PayPal payments for private tickets', () => {
    cy.visit('http://localhost:8001/tickets')
    cy.get('#type-private').click()
    cy.get('#payment-invoice').should('be.disabled')
  })

  it('should calculate totals', () => {
    cy.visit('http://localhost:8001/tickets')
    cy.get('#type-private').click()
    cy.get('#ticketCount').focus().clear().type('3').blur()
    cy.get('#single-price').then(single => {
      cy.get('#invoice-details').then(totals => {
        expect(totals.text()).to.equal(`Summe: ${(single.text() * 3).toFixed(2)}€ inkl. 19% MWSt.`)
      })
    })
  })
})
