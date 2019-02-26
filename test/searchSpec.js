'use strict';

require('barrkeep');

const should = require('should');
const ldap = require('@mdbarr/ldapjs');
const Dapper = require('../lib/dapper');

function searchParser(error, res, callback) {
  if (error) {
    return callback(error);
  }

  const result = {
    reference: null,
    items: [],
    status: 0
  };

  res.on('searchEntry', function(entry) {
    result.items.push(Object.clone(entry.object));
  });

  res.on('searchReference', function(referral) {
    result.reference = referral.uris.join();
  });

  res.on('error', function(err) {
    callback(err);
  });

  res.on('end', function(end) {
    result.status = end.status;
    callback(null, result);
  });
}

describe('Search Spec', function() {
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

    it('should successfully bind to the ldap server', function(done) {
      client.bind('uid=foo, ou=users, dc=dapper, dc=test', 'password', function(error, result) {
        should(result).not.be.null();
        done();
      });
    });
  });

  describe('Search Tests', function() {
    it('should perform and validate a base scope search', function(done) {
      client.search('uid=foo, ou=users, dc=dapper, dc=test', {
        filter: '(dn=uid=foo, ou=users, dc=dapper, dc=test)'
      }, function(err, res) {
        searchParser(err, res, function(error, result) {
          result.should.have.property('items');
          result.items.should.be.instanceOf(Array);
          result.items.should.have.length(1);
          result.items[0].should.have.property('dn', 'uid=foo, ou=users, dc=dapper, dc=test');
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
