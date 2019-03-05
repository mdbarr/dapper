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

  self.preferredDN = function(currentDN, newDN) {
    currentDN = currentDN || '';
    newDN = newDN || '';

    if (!currentDN) {
      return newDN;
    }

    const countA = currentDN.split(/=/).length;
    const countB = newDN.split(/=/).length;

    // Prefer specificity
    if (countA > countB) {
      return currentDN;
    } else if (countB > countA) {
      return newDN;
    } else if (currentDN.length > newDN.length) {
      return currentDN;
    } else {
      return newDN;
    }
  };

  self.toDN = function(values, dnSet, bindSet) {
    values = values.filter((value) => !!value);
    const bindValues = values.slice();
    bindValues.shift();

    const dn = values.join(', ');
    const bind = bindValues.join(', ');

    if (dn) {
      dnSet.add(dn);
    }

    if (bind) {
      bindSet.add(bind);
    }

    return dn;
  };

  self.parseDN = function(dn, tree = dapper.tree) {
    const rdns = {};

    const model = tree.ldap.dns.get(dn);

    if (model) {
      dn = dn.replace(/cn=(.*?), ou=Groups/, function(match, p1) {
        p1 = p1.trim();
        rdns.group = tree.models.groups[p1] || null;
        return '';
      });

      dn = dn.replace(/o=(.*?),\s*/, function(match, p1) {
        p1 = p1.trim();
        rdns.organization = tree.models.organizations[p1] || null;
        return '';
      });

      dn = dn.replace(/dc=(.*)$/, function(match, p1) {
        p1 = p1.trim().replace(/, dc=/g, '.');
        rdns.domain = tree.models.domains[p1] || null;
        return '';
      });

      const item = tree.models.index[ model.id ];

      rdns[ item.object ] = item;
    }

    return rdns;
  };

  self.mfaRequired = function(dn, user, tree = dapper.tree) {
    if (user.attributes.mfaRequired) {
      return true;
    }
    const rdns = self.parseDN(dn, tree);

    for (const key in rdns) {
      const model = rdns[key];

      if (model.options && model.options.mfaRequired) {
        return true;
      }

      if (model.attributes && model.attributes.mfaRequired) {
        return true;
      }
    }
    return false;
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
