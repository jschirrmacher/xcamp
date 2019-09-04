const baseUrl = 'http://localhost:8001/'

describe('Editing nodes', () => {
  it('should allow multiple edits', function () {
    const descriptionFieldSelector = 'div[data-name="description"]'
    cy.visit(baseUrl + 'orga/test/login/user')
    cy.wait(2000)
    cy.get('#profile').click()
    cy.wait(2000)
    cy.get(descriptionFieldSelector).type('This is a test at ' + new Date())
    cy.wait(2000)
    cy.get(descriptionFieldSelector).focus().clear().type('Changed test description')
    cy.wait(2000)
    cy.visit(baseUrl + 'orga/test/login/user')
    cy.wait(2000)
    cy.get('#profile').click()
    cy.wait(2000)
    cy.get(descriptionFieldSelector).then(description => {
      expect(description.text()).to.equal('Changed test description')
    })
  })
})
