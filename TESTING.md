# Test cases

## Org API

### Create first org member 

- Create via API call `POST /orga`
- To create the first org member (empty database) it shouldn't require a login
- There should be sent an e-mail containing an activation link
- The activation link should bring up a page requiring to set the password
- After setting the password, the users should be directed to their NetVis node

### Create second org member

- This API call should require a logged in user having admin privileges

### Create coupon

- via `POST orga/coupon`
- It return a link to be used to register

### Use coupon

- Use link from coupon creation
- Price should be reduced
- Payment method should only be PayPal
- After payment user should be logged in and see their node in NetVis
- There should be an invoice

### User coupon again

- Use previous coupon link again
- It should not work (and display an error message)


## Normal ticket sale

### Buy individual ticket

- The price should match the specification
- There should not be a company field
- Payment method should only be PayPal
- Buy button should only be enabled if checkbox for terms-of-service is set
- After payment user should be logged in and see their node in NetVis
- There should be an invoice

### Buy corporate tickets

- The price should match the specification
- There should be a company field
- Specify more than one ticket
- Payment methods should include PayPal and invoice
- Both payment methods should work
- Buy button should only be enabled if checkbox for terms-of-service is set
- After payment user should be logged in and see their account page with invoices and tickets

### Buy another ticket

- Use the same e-mail address as before -> currently this should fail
- (The additional ticket should be available in the ticket list)
- (There should be another invoice)

## Account

### Set password

### Change password

### Login

### Forgot password

### See invoice

### Transfer ticket to another person

### Print ticket


## NetVis

### Anonymous usage

- It should be possible to use the network visualization  even when not logged in
- It should not be possible to edit anything: person's data or topics

### Usage as a logged in user

- It should be possible to login
- The login button should then not be visible any more

### Editing nodes
- Users should change their own node when logged in
- Normal users should not be able to change foreign nodes
- Normal users should be able to change topic contents
- Admin users should be able to change all nodes
