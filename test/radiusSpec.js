'use strict';

const should = require('should');
const Dapper = require('../lib/dapper');
const RadiusClient = require('./radiusClient');

describe('Radius Spec', function() {
  let dapper;
  let config;
  let client;

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

    it('should create a radius/udp client', function(done) {
      client = new RadiusClient(dapper);
      client.bind(done);
    });
  });

  describe('Access Request Tests', function() {
    it('should send and validate a successful access request', function(done) {
      const packet = client.packet();

      client.send(packet, function(error, response) {
        should(error).be.null();

        should(response).be.ok();
        response.should.have.property('code', client.constants.accept);

        done();
      });
    });

    it('should send and validate an unsuccessful access request', function(done) {
      const packet = client.packet({
        password: 'bad-password'
      });

      client.send(packet, function(error, response) {
        should(error).be.null();

        should(response).be.ok();
        response.should.have.property('code', client.constants.reject);

        done();
      });
    });

    it('should send and validate an access request with a bad secret', function(done) {
      const packet = client.packet({
        secret: 'bad-secret'
      });

      client.send(packet, function(error, response) {
        should(error).be.ok();
        error.should.equal(client.constants.reject);

        should(response).be.ok();
        response.should.have.property('code', client.constants.reject);

        done();
      });
    });
  });

  describe('Clean up', function() {
    it('should unbind the client', function(done) {
      client.unbind(done);
    });

    it('should stop the dapper instance', function(done) {
      dapper.shutdown(done);
    });
  });
});
