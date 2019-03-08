'use strict';

const dgram = require('dgram');
const radius = require('radius');

function RadiusClient(dapper) {
  const self = this;

  const socket = dgram.createSocket('udp4');

  //////////

  self.constants = {
    accept: 'Access-Accept',
    ip: 'NAS-IP-Address',
    password: 'User-Password',
    reject: 'Access-Reject',
    request: 'Access-Request',
    username: 'User-Name'
  };

  //////////

  const packets = {};
  const handlers = {};
  let packetCount = 0;

  //////////

  function handler(message) {
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

    if (handlers[response.identifier]) {
      const callback = handlers[response.identifier];
      delete handlers[response.identifier]; // call only once

      callback(valid ? null : response.code, response);
    }
  }

  //////////

  self.packet = function({
    code = self.constants.request,
    secret = dapper.config.radius.secret,
    identifier = ++packetCount,
    ip = '127.0.0.1',
    username = dapper.config.datastore.data.users[0].username,
    password = dapper.config.datastore.data.users[0].password
  } = {}) {
    const packet = {
      code,
      secret,
      identifier,
      attributes: [
        [ self.constants.ip, ip ],
        [ self.constants.username, username ],
        [ self.constants.password, password ]
      ]
    };

    return packet;
  };

  self.send = function(packet, callback) {
    handlers[packet.identifier] = callback;

    const encoded = radius.encode(packet);
    packets[packet.identifier] = {
      raw_packet: encoded,
      secret: packet.secret
    };

    socket.send(encoded, 0, encoded.length, dapper.config.radius.port, 'localhost');
  };

  //////////

  self.bind = function(callback) {
    socket.on('message', handler);

    socket.bind(49001, callback);
  };

  self.unbind = function(callback) {
    socket.close(callback);
  };

  //////////

  return self;
};

module.exports = RadiusClient;
