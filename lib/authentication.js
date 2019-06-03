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
    user, password, mfaRequired, mfaInline
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

  // sha256 of ''
  const blankPassword = 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const fallbackRadius = function({
    user, password, mfaRequired, mfaInline, mfa
  }, callback) {
    if (user.password && user.password !== blankPassword) {
      return internal({
        user,
        password,
        mfaRequired,
        mfaInline,
        mfa
      }, callback);
    }
    return radius({
      user,
      password,
      mfaRequired,
      mfaInline,
      mfa
    }, (authenticated) => {
      if (authenticated) {
        user.password = dapper.util.ensureSecure(password);

        console.log(`[radius] caching encrypted password for ${ user.username }: ${ user.password }`);

        return dapper.store.provider.update(user, () => {
          return callback(authenticated);
        });
      }
      return callback(authenticated);
    });
  };

  /////////

  self.providers = {
    internal,
    radius,
    'fallback-radius': fallbackRadius
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
