'use strict';

const should = require('should');
const ldap = require('@mdbarr/ldapjs');
const Dapper = require('../lib/dapper');

function searchParser(dapper, error, res, callback) {
  callback = dapper.util.callback(callback);
  if (error) {
    return callback(error);
  }

  const result = {
    reference: null,
    items: [],
    status: 0
  };

  res.on('searchEntry', (entry) => {
    result.items.push(Object.clone(entry.object));
  });

  res.on('searchReference', (referral) => {
    result.reference = referral.uris.join();
  });

  res.on('error', (err) => {
    callback(err);
  });

  res.on('end', (end) => {
    result.status = end.status;
    callback(null, result);
  });

  return res;
}

describe('Search Spec', () => {
  let dapper;
  let config;
  let client;

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

    it('should create an ldap client', () => {
      client = ldap.createClient({ url: 'ldap://127.0.0.1:389' });
    });

    it('should successfully bind to the ldap server', (done) => {
      client.bind('uid=foo, ou=Users, o=QA, dc=dapper, dc=test', 'password', (error, result) => {
        should(error).be.null();
        should(result).be.ok();
        done();
      });
    });
  });

  describe('Search Tests', () => {
    it('should perform and validate a base scope search', (done) => {
      client.search('uid=foo, ou=Users, o=QA, dc=dapper, dc=test',
        { filter: '(&(cn=Fooey)(email=foo@dapper.test))' }, (err, res) => {
          searchParser(dapper, err, res, (error, result) => {
            result.should.have.property('items');
            result.items.should.be.instanceOf(Array);
            result.items.should.have.length(1);
            result.items[0].should.have.property('dn', 'uid=foo, ou=Users, o=QA, dc=dapper, dc=test');
            done();
          });
        });
    });

    it('should perform and validate a sub scope search with attributes', (done) => {
      client.search('dc=dapper, dc=test', {
        filter: '(&(o=QA)(email=*@dapper.test))',
        scope: 'sub',
        attributes: [ 'dn', 'sn', 'cn' ]
      }, (err, res) => {
        searchParser(dapper, err, res, (error, result) => {
          result.should.have.property('items');
          result.items.should.be.instanceOf(Array);
          result.items.should.have.length(1);
          result.items[0].should.have.property('dn', 'cn=Fooey, ou=Users, dc=dapper, dc=test');
          result.items[0].should.have.property('cn', 'Fooey');
          result.items[0].should.have.property('sn', 'Fooey');
          result.items[0].should.not.have.property('email');
          done();
        });
      });
    });

    it('should perform and validate a one scope search with attributes', (done) => {
      client.search('dc=dapper, dc=test', {
        filter: '(&(o=QA)(objectclass=organization))',
        scope: 'one',
        attributes: [ 'dn', 'o' ]
      }, (err, res) => {
        searchParser(dapper, err, res, (error, result) => {
          result.should.have.property('items');
          result.items.should.be.instanceOf(Array);
          result.items.should.have.length(1);
          result.items[0].should.have.property('o', 'QA');
          done();
        });
      });
    });

    it('should perform and validate a sub scope search for group membership', (done) => {
      client.search('dc=dapper, dc=test', {
        filter: '(memberOf=cn=Admin, ou=Groups, o=Dev, dc=dapper, dc=test)',
        scope: 'sub',
        attributes: [ 'dn', 'sn', 'cn' ]
      }, (err, res) => {
        searchParser(dapper, err, res, (error, result) => {
          result.should.have.property('items');
          result.items.should.be.instanceOf(Array);
          result.items.should.have.length(1);
          result.items[0].should.have.property('dn', 'cn=Fooey, ou=Users, dc=dapper, dc=test');
          result.items[0].should.have.property('cn', 'Fooey');
          result.items[0].should.have.property('sn', 'Fooey');
          result.items[0].should.not.have.property('email');
          done();
        });
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
