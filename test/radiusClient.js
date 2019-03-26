'use strict';

const dgram = require('dgram');
const radius = require('radius');

function RadiusClient(dapper, options = {}) {
  const self = this;

  const socket = dgram.createSocket('udp4');

  //////////

  self.constants = {
    accepted: 'Access-Accept',
    ip: 'NAS-IP-Address',
    password: 'User-Password',
    rejected: 'Access-Reject',
    request: 'Access-Request',
    username: 'User-Name'
  };

  //////////

  const requests = {};
  const handlers = {};
  let requestCount = 0;

  //////////

  function handler(message) {
    const response = radius.decode({
      packet: message,
      secret: options.secret || dapper.config.radius.secret
    });

    const request = requests[response.identifier];

    const valid = radius.verify_response({
      response: message,
      request: request.rawPacket,
      secret: request.secret
    });

    if (handlers[response.identifier]) {
      const callback = handlers[response.identifier];
      delete handlers[response.identifier]; // call only once

      return callback(valid ? null : response.code, response);
    }

    return response;
  }

  //////////

  self.send = function(request, callback) {
    handlers[request.identifier] = callback;

    const encoded = radius.encode(request);
    requests[request.identifier] = {
      rawPacket: encoded,
      secret: request.secret
    };

    return socket.send(encoded, 0, encoded.length,
      options.port || dapper.config.radius.port,
      options.host || 'localhost');
  };

  self.request = function({
    code = self.constants.request,
    secret = options.secret || dapper.config.radius.secret,
    identifier = ++requestCount,
    ip = '127.0.0.1',
    username = options.username || dapper.config.datastore.data.users[0].username,
    password = options.password || dapper.config.datastore.data.users[0].password
  } = {}, done) {
    const request = {
      code,
      secret,
      identifier,
      attributes: [
        [ self.constants.ip, ip ],
        [ self.constants.username, username ],
        [ self.constants.password, password ]
      ]
    };

    Object.$private(request, 'send', (callback) => {
      self.send(request, callback);
    });

    if (typeof done === 'function') {
      return request.send(done);
    }

    return request;
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
}

module.exports = RadiusClient;
