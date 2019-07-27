'use strict';

const argon2 = require('argon2');
const otplib = require('otplib');
const RadiusClient = require('../utils/radiusClient');

function Authentication(dapper) {
  const self = this;

  self.log = dapper.log.child({ service: 'auth' });

  //////////

  self.hashPassword = function(password, callback) {
    if (!password) {
      return callback(null, false);
    }
    return argon2.hash(password).
      then((hash) => {
        return callback(null, hash);
      }).
      catch((error) => {
        return callback(error);
      });
  };

  self.validatePassword = function(input, hash, callback) {
    callback = dapper.util.callback(callback, true);

    if (!input || !hash) {
      return callback(null, false);
    }

    if (!hash.startsWith('$argon2')) {
      if (dapper.config.options.allowPlainTextPasswords) {
        return callback(null, input === hash);
      }
      return callback(null, false);
    }

    return argon2.verify(hash, input).
      then((verified) => {
        return callback(null, verified);
      }).
      catch((error) => {
        return callback(error);
      });
  };

  self.ensureSecure = function(password, callback) {
    if (!password) { // no password set, impossible to auth
      return callback(null, false);
    }

    if (password.startsWith('$argon2')) {
      return callback(null, password);
    }
    return self.hashPassword(password, callback);
  };

  self.validatePasswordMFA = function({
    password, hash, token, secret
  }, callback) {
    return self.validatePassword(password, hash, (error, verified) => {
      if (error) {
        return callback(error);
      }

      if (!verified) {
        return callback(null, false);
      }

      return callback(null, self.validateToken(token, secret));
    });
  };

  self.generateSecret = function() {
    return otplib.authenticator.generateSecret();
  };

  self.generateToken = function(secret) {
    return otplib.authenticator.generate(secret);
  };

  self.validateToken = function(token, secret) {
    return otplib.authenticator.check(token, secret);
  };

  //////////

  const internal = function({
    user, password, mfaRequired, mfaInline, mfa
  }, callback) {
    callback = dapper.util.callback(callback);

    if (!user.password || user.attributes.accountLocked) {
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

      return self.validatePasswordMFA({
        password,
        hash: user.password,
        token: mfa,
        secret: user.mfa
      }, (error, verified) => {
        if (error) {
          return callback(false);
        }
        return callback(verified);
      });
    }

    return self.validatePassword(password, user.password, (error, verified) => {
      if (error) {
        return callback(false);
      }
      return callback(verified);
    });
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

  const fallbackRadius = function({
    user, password, mfaRequired, mfaInline, mfa
  }, callback) {
    if (user.password) {
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
        return self.hashPassword(password, (error, hash) => {
          if (error) {
            return callback(authenticated);
          }

          user.password = hash;

          self.log.info(`caching encrypted password for ${ user.username }: ${ user.password }`);

          return dapper.store.provider.update(user, () => {
            return callback(authenticated);
          });
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
      self.log.debug(`Invalid authentication provider ${ dapper.config.authentication.provider }`);
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
