'use strict';

const dgram = require('dgram');
const radius = require('radius');

const RADIUS_DEFAULT_PORT = 1812;

function RadiusServer(dapper) {
  const self = this;

  //////////

  dapper.radius = dgram.createSocket('udp4');

  //////////

  self.whitelist = dapper.util.nop;

  self.authorize = function(username, password, callback) {
    callback = dapper.util.callback(callback);

    if (!username || !password) {
      return callback(false);
    }

    const user = dapper.tree.models.users[username];

    if (!user || user.object !== 'user') {
      return callback(false);
    }

    if (!user.permissions.radius) {
      return callback(false);
    }

    const mfaRequired = dapper.config.radius.mfaRequired;

    return dapper.auth.authenticate(password, user, mfaRequired, callback);
  };

  //////////

  dapper.radius.on('message', (msg, rinfo) => {
    if (!self.whitelist(rinfo.address)) {
      return;
    }

    const packet = radius.decode({
      packet: msg,
      secret: dapper.config.radius.secret
    });

    if (packet.code !== 'Access-Request') {
      console.debug('Unknown packet type: ', packet.code);
      return;
    }

    const username = packet.attributes['User-Name'];
    const password = packet.attributes['User-Password'];

    console.debug(`Access-Request for ${ username }`);

    self.authorize(username, password, (authorized) => {
      const code = authorized ? 'Access-Accept' : 'Access-Reject';

      const response = radius.encode_response({
        packet,
        code,
        secret: dapper.config.radius.secret
      });

      console.debug(`Sending ${ code } for user ${ username }`);

      dapper.radius.send(response, 0, response.length, rinfo.port, rinfo.address, (error) => {
        if (error) {
          console.debug('Error sending response to ', rinfo);
        }
      });
    });
  });

  //////////

  self.boot = function(callback) {
    callback = dapper.util.callback(callback);

    if (!dapper.config.radius.enabled) {
      return callback();
    }

    self.whitelist = dapper.util.whitelist(dapper.config.radius.whitelist);

    if (dapper.config.radius.port === 'auto') {
      dapper.config.radius.port = RADIUS_DEFAULT_PORT;
    }

    return dapper.radius.bind(dapper.config.radius.port, () => {
      const address = dapper.radius.address();
      console.log(`Dapper Radius server listening at radius://${ address.address }:${ address.port }`);
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
