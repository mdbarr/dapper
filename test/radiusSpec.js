'use strict';

const should = require('should');
const Dapper = require('../lib/dapper');
const RadiusClient = require('./radiusClient');

describe('Radius Spec', () => {
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

    it('should create a radius/udp client', (done) => {
      client = new RadiusClient(dapper);
      client.bind(done);
    });
  });

  describe('Access Request Tests', () => {
    it('should send and validate a successful access request', (done) => {
      client.request({}, (error, response) => {
        should(error).be.null();

        should(response).be.ok();
        response.should.have.property('code', client.constants.accepted);

        done();
      });
    });

    it('should send and validate an unsuccessful access request', (done) => {
      client.request({ password: 'bad-password' }, (error, response) => {
        should(error).be.null();

        should(response).be.ok();
        response.should.have.property('code', client.constants.rejected);

        done();
      });
    });

    it('should send and validate an access request with a bad secret', (done) => {
      client.request({ secret: 'bad-secret' }, (error, response) => {
        should(error).be.ok();
        error.should.equal(client.constants.rejected);

        should(response).be.ok();
        response.should.have.property('code', client.constants.rejected);

        done();
      });
    });
  });

  describe('Clean up', () => {
    it('should unbind the client', (done) => {
      client.unbind(done);
    });

    it('should stop the dapper instance', (done) => {
      dapper.shutdown(done);
    });
  });
});
