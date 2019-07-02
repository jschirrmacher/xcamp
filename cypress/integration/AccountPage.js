const baseUrl = 'http://localhost:8001/'

describe('Account page', () => {
  it('should allow to change the participant', () => {
    cy.visit(baseUrl + 'orga/test/login/user')
    cy.visit(baseUrl + 'accounts/my')
    cy.get('.saveTicket').should('not.be.visible')
    cy.get('input[name="participant_firstName"]').type('{selectall}New')
    cy.get('input[name="participant_lastName"]').type('{selectall}Participant ' + (+new Date()))
    cy.get('input[name="participant_email"]').type('{selectall}' + (+new Date()) + '@dilab.co')
    cy.get('.saveTicket').should('be.visible')
    cy.get('.saveTicket').click()
    cy.get('.saveTicket').should('not.be.visible')
  })
})
