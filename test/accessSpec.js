'use strict';

require('barrkeep');

const should = require('should');
const ldap = require('@mdbarr/ldapjs');
const Dapper = require('../lib/dapper');

describe('Access Spec', function() {
  let dapper;
  let config;
  let client;

  describe('Instance Creation', function() {
    it('should load access testing configuration into memory', function() {
      config = require('./configs/accessConfig');
    });

    it('should create a new Dapper instance', function() {
      dapper = new Dapper(config);
      dapper.should.be.ok();
    });

    it('should boot the dapper instance', function(done) {
      dapper.boot(done);
    });

    it('should create an ldap client', function() {
      client = ldap.createClient({
        url: 'ldap://127.0.0.1:389'
      });
    });
  });

  describe('Access Tests - Search Permission', function() {
    it('should successfully bind to the ldap server', function(done) {
      client.bind('uid=foo, ou=Users, o=QA, dc=dapper, dc=test', 'secure', function(error, result) {
        should(error).be.null();
        should(result).be.ok();
        done();
      });
    });

    it('should fail searching bind user', function(done) {
      client.search('uid=foo, ou=Users, o=QA, dc=dapper, dc=test', {
        filter: '(&(cn=Fooey)(email=foo@dapper.test))'
      }, function(err, res) {
        res.on('error', function() {
          done();
        });

        res.on('end', function() {
          throw new Error('search should have failed');
        });
      });
    });
  });

  describe('Access Tests - MFA Required', function() {
    it('should fail binding without an mfa token', function(done) {
      client.bind('uid=bar, ou=Users, o=VPN, dc=dapper, dc=test', 'secret', function(error, result) {
        should(error).not.be.null();
        should(result).be.undefined();
        done();
      });
    });

    it('should fail binding without a bad mfa token', function(done) {
      client.bind('uid=bar, ou=Users, o=VPN, dc=dapper, dc=test', 'secret' + '000000', function(error, result) {
        should(error).not.be.null();
        should(result).be.undefined();
        done();
      });
    });

    it('should successfully bind to the ldap server', function(done) {
      const token = dapper.util.generateToken(config.datastore.data.users[1].mfa);
      client.bind('uid=bar, ou=Users, o=VPN, dc=dapper, dc=test', 'secret' + token, function(error, result) {
        should(error).be.null();
        should(result).be.ok();
        done();
      });
    });
  });

  describe('Clean up', function() {
    it('should close the client connection', function(done) {
      client.unbind(done);
    });

    it('should stop the dapper instance', function(done) {
      dapper.shutdown(done);
    });
  });
});
