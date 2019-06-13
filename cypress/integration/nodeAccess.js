const baseUrl = 'http://localhost:8001/'

function loginAsUser(userType) {
  cy.visit(baseUrl + 'orga/test/login/' + userType)
}

describe('Access to nodes', function() {
  it('should allow normal users modification of own node', function () {
    loginAsUser('user')
    cy.get('#profile').click()
    cy.wait(2000)
    cy.get('.detailForm').should('have.class', 'editable')
  })

  it('should restrict normal users from modifying foreign nodes', function () {
    loginAsUser('admin')
    cy.get('#profile').click()
    cy.url().then(url => {
      const id = url.replace(/^.*#/, '')
      loginAsUser('user')
      cy.wait(2000)
      cy.visit(baseUrl + '#' + id)
      cy.wait(2000)
      cy.get('.detailForm').should('not.have.class', 'editable')
    })
  })

  it('should allow admins to modify foreign nodes', function () {
    loginAsUser('user')
    cy.get('#profile').click()
    cy.url().then(url => {
      const id = url.replace(/^.*#/, '')
      loginAsUser('admin')
      cy.wait(2000)
      cy.visit(baseUrl + '#' + id)
      cy.wait(2000)
      cy.get('.detailForm').should('have.class', 'editable')
    })
  })
})
