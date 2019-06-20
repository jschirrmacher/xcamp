const baseUrl = 'http://localhost:8001/'

function loginAsUser(userType) {
  cy.visit(baseUrl + 'orga/test/login/' + userType)
  cy.wait(2000)
}

describe('Access to nodes', function() {
  it('should not show names when not logged in', function () {
    cy.visit(baseUrl + '?what=person')
    cy.wait(2000)
    cy.get('.person .title tspan').each($el => {
      expect($el.text()).to.equal('Teilnehmer')
    })
  })

  it('should show names when logged in', function () {
    loginAsUser('user')
    cy.visit(baseUrl + '?what=person')
    cy.get('.person .title tspan').each($el => {
      expect($el.text()).not.to.equal('Teilnehmer')
    })
  })

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
      cy.visit(baseUrl + '#' + id)
      cy.wait(2000)
      cy.get('.detailForm').should('have.class', 'editable')
    })
  })
})
