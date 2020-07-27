'use strict';

const should = require('should');
const Dapper = require('../lib/dapper');

const parseDN = require('@metastack/ldapjs').parseDN;

describe('Model Spec', () => {
  let dapper;

  it('should create a new Dapper instance', () => {
    dapper = new Dapper({ options: {
      addEmailDomains: true,
      parseEmailToDC: true,
      allowEmpty: true
    } });
    dapper.should.be.ok();
  });

  describe('Domain Model Tests', () => {
    let domain;
    let ldapDomain;

    it('should create and validate a domain model object', () => {
      domain = dapper.models.domain({ domain: 'test.example.com' });

      domain.should.be.ok();
      domain.should.have.property('object', 'domain');
      domain.should.have.property('domain', 'test.example.com');
    });

    it('should create and validate an ldap domain object', () => {
      ldapDomain = dapper.models.ldap.domain(domain);
      ldapDomain.should.be.ok();
      ldapDomain.should.have.property('object', 'ldapDomain');
      ldapDomain.should.have.property('dn', 'dc=test, dc=example, dc=com');
    });
  });

  describe('Organization Model Tests', () => {
    let organization;
    let ldapOrganization;

    it('should create and validate an organization model object', () => {
      organization = dapper.models.organization({ name: 'Product' });

      organization.should.be.ok();
      organization.should.have.property('object', 'organization');
      organization.should.have.property('name', 'Product');
    });

    it('should create and validate an ldap organization object', () => {
      ldapOrganization = dapper.models.ldap.organization(organization);
      ldapOrganization.should.be.ok();
      ldapOrganization.should.have.property('object', 'ldapOrganization');
      ldapOrganization.should.have.property('dn', 'o=Product, dc=test, dc=example, dc=com');
    });

    it('should validate the ldap organization DNs', () => {
      for (const dn of ldapOrganization.dns) {
        dn.should.equal(parseDN(dn).toString());
      }
    });
  });

  describe('Group Model Tests', () => {
    let group;
    let ldapGroup;

    it('should create and validate a group object', () => {
      group = dapper.models.group({
        name: 'VPN',
        organization: 'Product'
      });

      group.should.be.ok();
      group.should.have.property('object', 'group');
      group.should.have.property('name', 'VPN');
      group.should.have.property('organization', 'Product');
    });

    it('should create and validate an ldap group', () => {
      ldapGroup = dapper.models.ldap.group(group);
      ldapGroup.should.be.ok();
      ldapGroup.should.have.property('object', 'ldapGroup');
    });

    it('should validate the ldap group DNs', () => {
      for (const dn of ldapGroup.dns) {
        dn.should.equal(parseDN(dn).toString());
      }
    });
  });

  describe('User Model Tests', () => {
    let user;
    let ldapUser;

    it('should create a user object', () => {
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

      dapper.log.debug(user);
    });

    it('should update the user credentials', (done) => {
      dapper.auth.hashPassword(user.password, (error, hash) => {
        if (error) {
          throw error;
        }
        user.password = hash;
        user.mfa = dapper.auth.generateSecret();
        done();
      });
    });

    it('should validate the user object password', (done) => {
      user.password.should.not.equal('password');
      user.password.should.startWith('$argon2');
      dapper.auth.validatePassword('password', user.password, (error, valid) => {
        should(error).be.null();
        should(valid).be.true();
        done();
      });
    });

    it('should validate the user mfa token', () => {
      user.mfa.should.be.ok();
      user.mfa.should.have.length(16);

      const token = dapper.auth.generateToken(user.mfa);
      should(dapper.auth.validateToken(token, user.mfa)).be.true();
    });

    it('should create an ldap user object', () => {
      ldapUser = dapper.models.ldap.user(user);

      ldapUser.should.be.ok();
      ldapUser.should.have.property('object', 'ldapUser');

      dapper.tree.ldap.domains.should.have.key('dc=example, dc=com');

      dapper.log.debug(ldapUser);
    });

    it('should validate the ldap user DNs', () => {
      for (const dn of ldapUser.dns) {
        dn.should.equal(parseDN(dn).toString());
      }
    });
  });

  describe('Linkage Tests', () => {
    it('should verify dynamic organization was created', () => {
      dapper.tree.ldap.dns.should.have.key('o=QA');
      dapper.tree.ldap.dns.should.have.key('o=QA, dc=test, dc=example, dc=com');
    });

    it('should verify dynamic group was created', () => {
      dapper.tree.ldap.dns.should.have.key('cn=Vault, ou=Groups');
      dapper.tree.ldap.dns.should.have.key('cn=Vault, ou=Groups, dc=test, dc=example, dc=com');
    });

    it('should verify dynamic user distinguished names', () => {
      dapper.tree.ldap.dns.should.have.key(
        'email=test@example.com, ou=Users, dc=example, dc=com');
      dapper.tree.ldap.dns.should.have.key(
        'email=test@example.com, ou=Users, dc=test, dc=example, dc=com');
      dapper.tree.ldap.dns.should.have.key(
        'login=test, ou=Users, dc=test, dc=example, dc=com');
      dapper.tree.ldap.dns.should.have.key(
        'login=test@example.com, ou=Users, dc=example, dc=com');
      dapper.tree.ldap.dns.should.have.key(
        'uid=test, ou=Users, o=Product, dc=test, dc=example, dc=com');
      dapper.tree.ldap.dns.should.have.key(
        'uid=test, ou=Users, o=QA, dc=test, dc=example, dc=com');
    });
  });
});
