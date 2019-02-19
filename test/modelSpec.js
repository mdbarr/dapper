'use strict';

require('barrkeep');
const should = require('should');
const Dapper = require('../lib/dapper');
const parseDN = require('ldapjs').parseDN;

describe('Model Spec', function() {
  let dapper;

  it('should create a new Dapper instance', function() {
    dapper = new Dapper();
    dapper.should.be.ok();
  });

  describe('Domain Model Tests', function() {
    let domain;
    let ldapDomain;

    it('should create and validate a domain model object', function() {
      domain = dapper.models.domain({
        domain: 'test.example.com'
      });

      domain.should.be.ok();
      domain.should.have.property('object', 'domain');
      domain.should.have.property('domain', 'test.example.com');
    });

    it('should create and validate an ldap domain object', function() {
      ldapDomain = dapper.models.ldapDomain(domain);
      ldapDomain.should.be.ok();
      ldapDomain.should.have.property('object', 'ldapDomain');
      ldapDomain.should.have.property('dn', 'dc=test, dc=example, dc=com');
    });
  });

  describe('Organization Model Tests', function() {
    let organization;
    let ldapOrganization;

    it('should create and validate an organization model object', function() {
      organization = dapper.models.organization({
        name: 'Testers'
      });

      organization.should.be.ok();
      organization.should.have.property('object', 'organization');
      organization.should.have.property('name', 'Testers');
    });

    it('should create and validate an ldap organization object', function() {
      ldapOrganization = dapper.models.ldapOrganization(organization);
      ldapOrganization.should.be.ok()
      ldapOrganization.should.have.property('object', 'ldapOrganization');
      ldapOrganization.should.have.property('dn', 'o=testers');
    });
  });

  describe('Group Model Tests', function() {
    let group;
    let ldapGroup;

    it('should create and validate a group object', function() {
      group = dapper.models.group({
        name: 'UI Testers',
        organization: 'Testers'
      });

      group.should.be.ok();
      group.should.have.property('object', 'group');
      group.should.have.property('name', 'UI Testers');
      group.should.have.property('organization', 'Testers');
    });

    it('should create and validate an ldap group', function() {
      ldapGroup = dapper.models.ldapGroup(group);
      ldapGroup.should.be.ok();
      ldapGroup.should.have.property('object', 'ldapGroup');
    });
  });

  describe('User Model Tests', function() {
    let user;
    let ldapUser;

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

      console.debug(user);
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
      for (const dn of ldapUser.dns) {
        dn.should.equal(parseDN(dn).toString());
      }
    });
  });
});
