'use strict';

const fs = require('fs');
const { v4: uuid } = require('uuid');
const utils = require('barrkeep/utils');

function Util (dapper) {
  const self = this;

  //////////

  self.id = () => {
    return uuid();
  };

  self.timestamp = utils.timestamp;

  self.nop = () => { return true; };

  self.callback = utils.callback;

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
    values = values.filter((value) => {
      return Boolean(value);
    });
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

      if (model) {
        if (model.options && model.options.mfaRequired) {
          return true;
        }

        if (model.attributes && model.attributes.mfaRequired) {
          return true;
        }
      }
    }
    return false;
  };

  self.sanitize = function(object) {
    const data = Object.assign({}, object);
    for (const property of self.sanitize.properties) {
      delete data[property];
    }
    return data;
  };
  self.sanitize.properties = [ 'password', 'mfa' ];

  self.readPEM = function(string) {
    if (!string) {
      return undefined;
    } else if (string.endsWith('.pem')) {
      return fs.readFileSync(string);
    }
    return string;
  };

  return self;
}

module.exports = function(dapper) {
  return new Util(dapper);
};
