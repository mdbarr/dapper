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

  describe('Access Tests', function() {
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
          done();
        });
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
