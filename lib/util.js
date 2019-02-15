'use strict';

const uuid = require('uuid/v4');
const crypto = require('crypto');
const otplib = require('otplib');

function Util(dapper) {
  const self = this;

  //////////

  self.id = () => uuid();

  self.timestamp = () => Date.now();

  self.sha256 = function(input) {
    if (typeof input !== 'string') {
      input = JSON.stringify(input);
    }
    return crypto.createHash('sha256').update(input).digest('hex');
  };

  self.ensureSecure = function(password = '') {
    if (!password.startsWith('sha256:') || password.length !== 71) {
      return 'sha256:' + self.sha256(password);
    }
    return password;
  };

  self.validatePassword = function(input, password) {
    if (!password.startsWith('sha256:') || password.length !== 71) {
      return false;
    }
    return self.ensureSecure(input) === password;
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

  self.Set = function(value) {
    if (!Array.isArray(value)) {
      value = [ value ];
    }

    const set = new Set(value);
    if (dapper.config.options.allowEmpty) {
      set.add('');
    }

    return set;
  };

  self.toDN = function(values, dnSet, bindSet) {
    values = values.filter((value) => !!value);
    const bindValues = values.slice();
    bindValues.shift();

    const dn = values.join(', ').toLowerCase();
    const bind = bindValues.join(', ').toLowerCase();

    if (dn) {
      dnSet.add(dn);
    }

    if (bind) {
      bindSet.add(bind);
    }

    return dn;
  };

  self.callback = function(callback) {
    callback = callback || function() {};
    return function(error, data) {
      setImmediate(function() {
        callback(error, data);
      });
    };
  };

  ///////////
  // Shims

  Object.private = function(object, name, value) {
    return Object.defineProperty(object, name, {
      configurable: true,
      enumerable: false,
      value,
      writable: true
    });
  };

  console.debug = function() {
    if (process.env.DEBUG) {
      console.pp.apply(this, Array.from(arguments));
    }
  };

  return self;
}

module.exports = function(dapper) {
  return new Util(dapper);
};
