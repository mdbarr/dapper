'use strict';

const dgram = require('dgram');
const radius = require('radius');

function RadiusServer(dapper) {
  const self = this;

  //////////

  dapper.radius = dgram.createSocket('udp4');

  //////////

  self.authorize = function(username, password) {
    if (!username || !password) {
      return false;
    }

    const user = dapper.tree.models.users[username];

    if (!user || user.object !== 'user') {
      return false;
    }

    if (dapper.config.radius.mfaRequired) {
      if (!user.attributes.mfaEnabled) {
        return false;
      }

      if (dapper.util.validatePasswordMFA(password, user.password, user.mfa)) {
        return true;
      }

    } else if (dapper.util.validatePassword(password, user.password)) {
      return true;
    }

    return false;
  };

  //////////

  dapper.radius.on('message', function (msg, rinfo) {
    const packet = radius.decode({
      packet: msg,
      secret: dapper.config.radius.secret
    });

    if (packet.code !== 'Access-Request') {
      console.log('Unknown packet type: ', packet.code);
      return;
    }

    const username = packet.attributes['User-Name'];
    const password = packet.attributes['User-Password'];

    console.log('Access-Request for ' + username);

    const code = self.authorize(username, password) ? 'Access-Accept' : 'Access-Reject';

    const response = radius.encode_response({
      packet: packet,
      code: code,
      secret: dapper.config.radius.secret
    });

    console.log('Sending ' + code + ' for user ' + username);

    dapper.radius.send(response, 0, response.length, rinfo.port, rinfo.address, function(error) {
      if (error) {
        console.log('Error sending response to ', rinfo);
      }
    });
  });

  //////////

  self.boot = function(callback) {
    callback = dapper.util.callback(callback);

    dapper.radius.bind(dapper.config.radius.port, function() {
      const address = dapper.radius.address();
      console.log('Dapper Radius server listening at radius://' + address.address + ':' + address.port);
      callback();
    });
  };

  self.shutdown = function(callback) {
    callback = dapper.util.callback(callback);
    dapper.radius.close(callback);
  };

  //////////

  return self;
};

module.exports = function(dapper) {
  return new RadiusServer(dapper);
};
