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
    it('should load Sample Data A into memory', function() {
      config = require('./sampleDataA');
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

  describe('Access Tests', function() {
    it('should successfully bind to the ldap server', function(done) {
      client.bind('uid=foo, ou=Users, o=QA, dc=dapper, dc=test', 'password', function(error, result) {
        should(result).not.be.null();
        done();
      });
    });
  });

  describe('Clean up', function() {
    it('should close the client connection', function(done) {
      client.unbind(done);
    });

    it('should stop the dapper instance', function() {
      dapper.shutdown();
    });
  });
});
