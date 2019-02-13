'use strict';

require('should');
require('barrkeep');
const Dapper = require('../lib/dapper');
const parseDN = require('ldapjs').parseDN;

describe('Model Spec', function() {
  let dapper;

  let user;
  let ldapUser;

  it('should create a new Dapper instance', function() {
    dapper = new Dapper();
    dapper.should.be.ok();
  });

  it('should create a user object', function() {
    user = dapper.models.user({
      username: 'test',
      password: 'password',
      name: 'Testy McTest',
      email: 'test@example.com',
      organization: 'QA'
    });

    user.should.be.ok();
    user.should.have.property('object', 'user');
  });

  it('should create an ldap user object', function() {
    ldapUser = dapper.models.ldapUser(user);

    ldapUser.should.be.ok();
    ldapUser.should.have.property('object', 'ldapUser');

    console.pp(ldapUser);
  });

  it('should validate the ldap user DNs', function() {
    for (const dn of ldapUser.dn) {
      dn.should.equal(parseDN(dn).toString());
    }
  });
});
