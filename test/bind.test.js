'use strict';

const should = require('should');
const ldap = require('@mdbarr/ldapjs');
const Dapper = require('../lib/dapper');

describe('Bind Spec', () => {
  let dapper;
  let config;

  describe('Instance Creation', () => {
    it('should load simple configuration into memory', () => {
      config = require('./configs/simpleConfig.js');
    });

    it('should create a new Dapper instance', () => {
      dapper = new Dapper(config);
      dapper.should.be.ok();
    });

    it('should boot the dapper instance', (done) => {
      dapper.boot(done);
    });
  });

  describe('Bind Tests', () => {
    let client;

    it('should create an ldap client', () => {
      client = ldap.createClient({ url: dapper.ldap.url });
    });

    it('should attempt to bind to the ldap server with a bad uid', (done) => {
      client.bind('uid=test, ou=Users, dc=dapper, dc=test', 'secret', (error) => {
        should(error).not.be.null();
        done();
      });
    });

    it('should attempt to bind to the ldap server with a bad password', (done) => {
      client.bind('uid=foo, ou=Users, dc=dapper, dc=test', 'secret', (error) => {
        should(error).not.be.null();
        done();
      });
    });

    it('should successfully bind to the ldap server', (done) => {
      client.bind('uid=foo, ou=Users, dc=dapper, dc=test', 'password', (error, result) => {
        should(error).be.null();
        should(result).be.ok();
        done();
      });
    });

    it('should close the client connection', (done) => {
      client.unbind(done);
    });
  });

  describe('Clean up', () => {
    it('should stop the dapper instance', (done) => {
      dapper.shutdown(done);
    });
  });
});
