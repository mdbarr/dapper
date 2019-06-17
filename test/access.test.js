'use strict';

const should = require('should');
const ldap = require('@mdbarr/ldapjs');
const Dapper = require('../lib/dapper');

describe('Access Spec', () => {
  let dapper;
  let config;
  let client;

  describe('Instance Creation', () => {
    it('should load access testing configuration into memory', () => {
      config = require('./configs/mfaConfig');
    });

    it('should create a new Dapper instance', () => {
      dapper = new Dapper(config);
      dapper.should.be.ok();
    });

    it('should boot the dapper instance', (done) => {
      dapper.boot(done);
    });

    it('should create an ldap client', () => {
      client = ldap.createClient({ url: dapper.ldap.url });
    });
  });

  describe('Access Tests - Search Permission', () => {
    it('should successfully bind to the ldap server', (done) => {
      client.bind('uid=foo, ou=Users, o=QA, dc=dapper, dc=test', 'secure', (error, result) => {
        should(error).be.null();
        should(result).be.ok();
        done();
      });
    });

    it('should fail searching bind user', (done) => {
      client.search('uid=foo, ou=Users, o=QA, dc=dapper, dc=test',
        { filter: '(&(cn=Fooey)(email=foo@dapper.test))' }, (err, res) => {
          if (err) {
            throw err;
          }

          res.on('error', () => {
            done();
          });

          res.on('end', () => {
            throw new Error('search should have failed');
          });
        });
    });
  });

  describe('Access Tests - MFA Required', () => {
    it('should fail binding without an mfa token', (done) => {
      client.bind('uid=bar, ou=Users, o=VPN, dc=dapper, dc=test', 'secret', (error, result) => {
        should(error).not.be.null();
        should(result).be.undefined();
        done();
      });
    });

    it('should fail binding without a bad mfa token', (done) => {
      client.bind('uid=bar, ou=Users, o=VPN, dc=dapper, dc=test', 'secret000000', (error, result) => {
        should(error).not.be.null();
        should(result).be.undefined();
        done();
      });
    });

    it('should successfully bind to the ldap server', (done) => {
      const token = dapper.auth.generateToken(config.datastore.data.users[1].mfa);
      client.bind('uid=bar, ou=Users, o=VPN, dc=dapper, dc=test', `secret${ token }`, (error, result) => {
        should(error).be.null();
        should(result).be.ok();
        done();
      });
    });
  });

  describe('Clean up', () => {
    it('should close the client connection', (done) => {
      client.unbind(done);
    });

    it('should stop the dapper instance', (done) => {
      dapper.shutdown(done);
    });
  });
});
