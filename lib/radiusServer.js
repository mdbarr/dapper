'use strict';

const dgram = require('dgram');
const radius = require('radius');
const AccessControl = require('../utils/accessControl');

const RADIUS_DEFAULT_PORT = 1812;

function RadiusServer(dapper) {
  const self = this;

  //////////

  self.log = dapper.log.child({ service: 'radius' });

  self.lookup = function(username) {
    for (const key of dapper.config.radius.keys) {
      for (const id in dapper.tree.models.users) {
        const user = dapper.tree.models.users[id];
        if (user[key] === username) {
          return user;
        }
      }
    }
    return false;
  };

  self.authorize = function(username, password, callback) {
    callback = dapper.util.callback(callback);

    if (!username || !password) {
      return callback(false);
    }

    const user = self.lookup(username);

    if (!user || user.object !== 'user') {
      return callback(false);
    }

    if (!user.permissions.radius) {
      return callback(false);
    }

    const mfaRequired = dapper.config.radius.mfaRequired;

    return dapper.auth.authenticate({
      user,
      password,
      mfaRequired
    }, callback);
  };

  //////////

  const handler = (msg, rinfo) => {
    if (!self.access.check(rinfo.address)) {
      return;
    }

    const packet = radius.decode({
      packet: msg,
      secret: dapper.config.radius.secret
    });

    if (packet.code !== 'Access-Request') {
      self.log.debug('Unknown packet type: ', packet.code);
      return;
    }

    const username = packet.attributes['User-Name'];
    const password = packet.attributes['User-Password'];

    self.log.verbose(`access-request: ${ username }`);

    self.authorize(username, password, (authorized) => {
      const code = authorized ? 'Access-Accept' : 'Access-Reject';

      self.log.verbose(`${ code.toLowerCase() }: ${ username }`);

      const response = radius.encode_response({
        packet,
        code,
        secret: dapper.config.radius.secret
      });

      self.log.debug(`Sending ${ code } for user ${ username }`);

      dapper.radius.send(response, 0, response.length, rinfo.port, rinfo.address, (error) => {
        if (error) {
          self.log.debug('Error sending response to ', rinfo);
        }
      });
    });
  };

  //////////

  self.boot = function(callback) {
    callback = dapper.util.callback(callback);

    if (!dapper.config.radius.enabled) {
      return callback();
    }

    dapper.radius = dgram.createSocket('udp4');

    dapper.radius.on('message', handler);

    self.access = new AccessControl(dapper.config.radius.access);

    if (dapper.config.radius.port === 'auto') {
      dapper.config.radius.port = RADIUS_DEFAULT_PORT;
    }

    return dapper.radius.bind(dapper.config.radius.port, () => {
      const address = dapper.radius.address();

      if (dapper.config.radius.port === 0) {
        dapper.config.radius.port = address.port;
      }

      self.log.info(`Radius server listening at radius://${ address.address }:${ address.port }`);
      callback();
    });
  };

  self.shutdown = function(callback) {
    callback = dapper.util.callback(callback);

    if (!dapper.config.radius.enabled) {
      return callback();
    }

    return dapper.radius.close(callback);
  };

  //////////

  return self;
}

module.exports = function(dapper) {
  return new RadiusServer(dapper);
};
