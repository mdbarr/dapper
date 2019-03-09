'use strict';

const uuid = require('uuid/v4');
const crypto = require('crypto');
const otplib = require('otplib');
const CIDRMatcher = require('cidr-matcher');

function Util(dapper) {
  const self = this;

  //////////

  self.id = () => {return uuid();};

  self.timestamp = () => {return Date.now();};

  self.nop = () => {return true;};

  self.sha256 = function(input) {
    if (typeof input !== 'string') {
      input = JSON.stringify(input);
    }
    return crypto.createHash('sha256').update(input).
      digest('hex');
  };

  self.ensureSecure = function(password = '') {
    if (!password.startsWith('sha256:') || password.length !== 71) {
      return `sha256:${ self.sha256(password) }`;
    }
    return password;
  };

  self.validatePassword = function(input, password) {
    if (!password.startsWith('sha256:') || password.length !== 71) {
      return false;
    }
    return self.ensureSecure(input) === password;
  };

  self.validatePasswordMFA = function(input, password, mfa) {
    let token;

    if (input.length <= 6) {
      return false;
    }

    input = input.replace(/(.{6,6})$/, (match, p1) => {
      token = p1;
      return '';
    });

    return self.ensureSecure(input) === password && self.validateToken(token, mfa);
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

  self.set = function(value) {
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
    }
    return newDN;

  };

  self.toDN = function(values, dnSet, bindSet) {
    values = values.filter((value) => {return Boolean(value);});
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
      dn = dn.replace(/cn=(.*?), ou=Groups/, (match, p1) => {
        p1 = p1.trim();
        rdns.group = tree.models.groups[p1] || null;
        return '';
      });

      dn = dn.replace(/o=(.*?),\s*/, (match, p1) => {
        p1 = p1.trim();
        rdns.organization = tree.models.organizations[p1] || null;
        return '';
      });

      dn = dn.replace(/dc=(.*)$/, (match, p1) => {
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
    if (user.attributes.mfaRequired || user.permissions.administrator) {
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

  self.whitelist = function(cidrs) {
    if (!Array.isArray(cidrs) || !cidrs.length) {
      return self.nop;
    }

    const matcher = new CIDRMatcher(cidrs);

    return function(ip) {
      return matcher.contains(ip);
    };
  };

  //////////

  self.callback = function(callback) {
    callback = callback || function() {};
    return function(error, data) {
      setImmediate(() => {
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

  console.debug = function(...args) {
    if (process.env.DEBUG) {
      console.pp.apply(this, Array.from(args));
    }
  };

  return self;
}

module.exports = function(dapper) {
  return new Util(dapper);
};
