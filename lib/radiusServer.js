'use strict';

const dgram = require('dgram');
const radius = require('radius');

function RadiusServer(dapper) {
  const self = this;

  //////////

  dapper.radius = dgram.createSocket('udp4');

  //////////

  dapper.radius.on('message', function (msg, rinfo) {
    const packet = radius.decode({
      packet: msg,
      secret: dapper.config.radius.secret
    });

    if (packet.code !== 'Access-Request') {
      console.log('unknown packet type: ', packet.code);
      return;
    }

    const username = packet.attributes['User-Name'];
    const password = packet.attributes['User-Password'];

    console.log('Access-Request for ' + username);

    let code = 'Access-Reject';
    if (username === 'dapper' && password === 'foo') {
      code = 'Access-Accept';
    }

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
