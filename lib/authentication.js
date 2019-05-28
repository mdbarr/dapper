'use strict';

const RadiusClient = require('../utils/radiusClient');

function Authentication(dapper) {
  const self = this;

  //////////

  const internal = function({
    user, password, mfaRequired, mfaInline, mfa
  }, callback) {
    callback = dapper.util.callback(callback);

    if (user.attributes.accountLocked) {
      return callback(false);
    }

    if (mfaRequired) {
      if (!user.attributes.mfaEnabled) {
        return callback(false);
      }

      if (mfaInline) {
        if (password.length <= 6) {
          return callback(false);
        }

        password = password.replace(/(.{6,6})$/, (match, p1) => {
          mfa = p1;
          return '';
        });
      }

      if (dapper.util.validatePasswordMFA(password, mfa, user.password, user.mfa)) {
        return callback(true);
      }
    } else if (dapper.util.validatePassword(password, user.password)) {
      return callback(true);
    }
    return callback(false);
  };

  //////////

  let radiusClient;

  const radius = function({
    password, user, mfaRequired, mfaInline
  }, callback) {
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

        return radius({
          password,
          user,
          mfaRequired,
          mfaInline
        }, callback);
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

  self.authenticate = function({
    user, password = '', mfaRequired = false, mfaInline = true, mfa = ''
  }, callback) {
    const authenticator = self.providers[dapper.config.authentication.provider];

    if (typeof authenticator !== 'function') {
      console.debug(`Invalid authentication provider ${ dapper.config.authentication.provider }`);
      return callback(false);
    }

    return authenticator({
      password,
      user,
      mfaRequired,
      mfaInline,
      mfa
    }, callback);
  };

  //////////

  return self;
}

module.exports = function(dapper) {
  return new Authentication(dapper);
};
