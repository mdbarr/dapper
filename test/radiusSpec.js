'use strict';

const dgram = require('dgram');
const radius = require('radius');
const should = require('should');
const Dapper = require('../lib/dapper');

describe('Radius Spec', function() {
  let dapper;
  let config;
  let client;

  //////////

  const packets = {};
  const packetHandlers = {};
  let packetCount = 0;

  function makePacket({
    code = 'Access-Request', secret = dapper.config.radius.secret,
    identifier = ++packetCount, ip = '127.0.0.1',
    username = config.datastore.data.users[0].username,
    password = config.datastore.data.users[0].password
  } = {}) {
    const packet = {
      code,
      secret,
      identifier,
      attributes: [
        [ 'NAS-IP-Address', ip ],
        [ 'User-Name', username ],
        [ 'User-Password', password ]
      ]
    };

    return packet;
  }

  function packetHandler(message) {
    const response = radius.decode({
      packet: message,
      secret: dapper.config.radius.secret
    });

    const request = packets[response.identifier];

    const valid = radius.verify_response({
      response: message,
      request: request.raw_packet,
      secret: request.secret
    });

    if (packetHandlers[response.identifier]) {
      const callback = packetHandlers[response.identifier];
      delete packetHandlers[response.identifier]; // call only once

      callback(valid ? null : response.code, response);
    }
  }

  function sendPacket(packet, callback) {
    packetHandlers[packet.identifier] = callback;

    const encoded = radius.encode(packet);
    packets[packet.identifier] = {
      raw_packet: encoded,
      secret: packet.secret
    };

    client.send(encoded, 0, encoded.length, dapper.config.radius.port, 'localhost');
  }

  //////////

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
      client = dgram.createSocket('udp4');
      client.on('message', packetHandler);
      client.bind(49001, done);
    });
  });

  describe('Access Request Tests', function() {
    it('should send and validate a successful access request', function(done) {
      const packet = makePacket();

      sendPacket(packet, function(error, response) {
        should(error).be.null();

        should(response).be.ok();
        response.should.have.property('code', 'Access-Accept');

        done();
      });
    });

    it('should send and validate an unsuccessful access request', function(done) {
      const packet = makePacket({
        password: 'bad-password'
      });

      sendPacket(packet, function(error, response) {
        should(error).be.null();

        should(response).be.ok();
        response.should.have.property('code', 'Access-Reject');

        done();
      });
    });

    it('should send and validate an access request with a bad secret', function(done) {
      const packet = makePacket({
        secret: 'bad-secret'
      });

      sendPacket(packet, function(error, response) {
        should(error).be.ok();
        error.should.equal('Access-Reject');

        should(response).be.ok();
        response.should.have.property('code', 'Access-Reject');

        done();
      });
    });
  });

  describe('Clean up', function() {
    it('should unbind the client', function(done) {
      client.close(done);
    });

    it('should stop the dapper instance', function(done) {
      dapper.shutdown(done);
    });
  });
});
