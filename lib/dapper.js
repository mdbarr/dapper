'use strict';

require('barrkeep');

const defaults = {
  options: {
    parseEmailToDC: true, // parse email addresses as additional DCs
    allowEmpty: true // allow empty fields for normal branches in the tree (dc, o)
  },
  users: {
    ou: 'Users',
    type: 'inetOrgPerson',
    groupMembership: 'memberOf',
    keys: [
      'cn', 'uid', 'email'
    ],
    multikeys: {
      login: [ 'uid', 'email' ]
    },
    primaryKey: 'uid'
  },
  groups: {
    ou: 'Groups',
    type: 'groupOfNames',
    memberAttribute: 'member'
  },
  ldap: {
    port: 389, // 'auto'
    whitelist: [ '0.0.0.0/0' ]
  },
  radius: {
    port: 1812, // 'auto'
    secret: '',
    mfaRequired: false,
    whitelist: [ '0.0.0.0/0' ]
  },
  api: {
    port: 1389 // 'auto' (ldap.port + 1000)
  },
  datastore: {
    provider: 'memory'
  }
};

function Dapper(config = {}) {
  const self = this;

  //////////

  self.version = require('../package.json').version;
  self.config = Object.merge(defaults, config, true);

  //////////

  self.util = require('./util')(self);
  self.models = require('./models')(self);
  self.store = require('./datastore')(self);

  self.apiServer = require('./apiServer')(self);
  self.ldapServer = require('./ldapServer')(self);
  self.radiusServer = require('./radiusServer')(self);

  //////////

  self.tree = self.models.tree();

  //////////

  self.boot = function(callback) {
    callback = self.util.callback(callback);

    self.store.populate(self.tree, function() {
      self.apiServer.boot(function() {
        self.ldapServer.boot(function() {
          self.radiusServer.boot(function() {
            callback();
          });
        });
      });
    });
  };

  self.shutdown = function(callback) {
    callback = self.util.callback(callback);

    self.ldapServer.shutdown(function() {
      self.radiusServer.shutdown(function() {
        callback();
      });
    });
  };

  //////////

  return self;
}

module.exports = Dapper;
