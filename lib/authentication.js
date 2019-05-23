'use strict';

const RadiusClient = require('../utils/radiusClient');

function Authentication(dapper) {
  const self = this;

  //////////

  const internal = function(password, user, mfaRequired, callback) {
    callback = dapper.util.callback(callback);

    if (user.attributes.accountLocked) {
      return callback(false);
    }

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

  //////////

  let radiusClient;

  const radius = function(password, user, mfaRequired, callback) {
    if (!radiusClient) {
      radiusClient = new RadiusClient(dapper, {
        host: dapper.config.authentication.host,
        port: dapper.config.authentication.port,
        secret: dapper.config.authentication.secret
      });

      return radiusClient.bind((error) => {
        if (error) {
          return callback(false);
        }

        return radius(password, user, mfaRequired, callback);
      });
    }
    return radiusClient.request({
      username: user.username,
      password
    }, (error, response) => {
      if (response && response.code === radiusClient.constants.accepted) {
        return callback(true);
      }
      return callback(false);
    });
  };

  /////////

  self.providers = {
    internal,
    radius
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

  //////////

  return self;
}

module.exports = function(dapper) {
  return new Authentication(dapper);
};
