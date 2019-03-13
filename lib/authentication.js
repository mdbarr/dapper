'use strict';

const RadiusClient = require('../test/radiusClient');

function Authentication(dapper) {
  const self = this;

  //////////

  const internal = function(password, user, mfaRequired, callback) {
    callback = dapper.util.callback(callback);

    if (mfaRequired) {
      if (!user.attributes.mfaEnabled) {
        return callback(false);
      }

      if (dapper.util.validatePasswordMFA(password, user.password, user.mfa)) {
        return callback(true);
      }
    } else if (dapper.util.validatePassword(password, user.password)) {
      return callback(true);
    }
    return callback(false);
  };

  const radiusClient = new RadiusClient(dapper, {
    host: dapper.config.authentication.host,
    port: dapper.config.authentication.port,
    secret: dapper.config.authentication.secret
  });

  radiusClient.bind();

  const radiusAuth = function(password, user, mfaRequired, callback) {
    radiusClient.request({
      username: user.username,
      password
    }, (error, response) => {
      if (response && response.code === radiusClient.constants.accepted) {
        return callback(true);
      }
      return callback(false);
    });
  };

  //////////

  self.providers = {
    internal,
    radius: radiusAuth
  };

  //////////

  self.authenticate = function(password, user, mfaRequired = false, callback) {
    const authenticate = self.providers[dapper.config.authentication.provider];

    if (typeof authenticate !== 'function') {
      console.debug(`Invalid authentication provider ${ dapper.config.authentication.provider }`);
      return callback(false);
    }

    return authenticate(password, user, mfaRequired, callback);
  };

  //////////

  return self;
}

module.exports = function(dapper) {
  return new Authentication(dapper);
};
