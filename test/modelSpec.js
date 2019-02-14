'use strict';

require('barrkeep');
const should = require('should');
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
      organizations: [ 'QA', 'Product' ],
      groups: [ 'VPN', 'Vault' ]
    });

    user.should.be.ok();
    user.should.have.property('object', 'user');
  });

  it('should validate the user object password', function() {
    user.password.should.not.equal('password');
    user.password.should.startWith('sha256:');
    should(dapper.util.validatePassword('password', user.password)).be.true();
  });

  it('should validate the user mfa token', function() {
    user.mfa.should.be.ok();
    user.mfa.should.have.length(32);

    const token = dapper.util.generateToken(user.mfa);
    should(dapper.util.validateToken(token, user.mfa)).be.true();
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
