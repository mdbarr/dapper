'use strict';

const should = require('should');
const ldap = require('@mdbarr/ldapjs');
const Dapper = require('../lib/dapper');

describe('Bind Spec', function() {
  let dapper;
  let config;

  describe('Instance Creation', function() {
    it('should load simple configuration into memory', function() {
      config = require('./configs/simpleConfig.js');
    });

    it('should create a new Dapper instance', function() {
      dapper = new Dapper(config);
      dapper.should.be.ok();
    });

    it('should boot the dapper instance', function(done) {
      dapper.boot(done);
    });
  });

  describe('Bind Tests', function() {
    let client;

    it('should create an ldap client', function() {
      client = ldap.createClient({
        url: 'ldap://127.0.0.1:389'
      });
    });

    it('should attempt to bind to the ldap server with a bad uid', function(done) {
      client.bind('uid=test, ou=Users, dc=dapper, dc=test', 'secret', function(error) {
        should(error).not.be.null();
        done();
      });
    });

    it('should attempt to bind to the ldap server with a bad password', function(done) {
      client.bind('uid=foo, ou=Users, dc=dapper, dc=test', 'secret', function(error) {
        should(error).not.be.null();
        done();
      });
    });

    it('should successfully bind to the ldap server', function(done) {
      client.bind('uid=foo, ou=Users, dc=dapper, dc=test', 'password', function(error, result) {
        should(error).be.null();
        should(result).be.ok();
        done();
      });
    });

    it('should close the client connection', function(done) {
      client.unbind(done);
    });
  });

  describe('Clean up', function() {
    it('should stop the dapper instance', function(done) {
      dapper.shutdown(done);
    });
  });
});
