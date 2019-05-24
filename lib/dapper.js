'use strict';

require('barrkeep/shim');
const async = require('async');

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
    multikeys: { login: [ 'uid', 'email' ] },
    primaryKey: 'uid'
  },
  groups: {
    ou: 'Groups',
    type: 'groupOfNames',
    memberAttribute: 'member'
  },
  ldap: {
    enabled: true,
    port: 'auto', // (ldap: 389, ldaps: 636)
    whitelist: [ '0.0.0.0/0' ]
  },
  radius: {
    enabled: true,
    port: 'auto', // (1812)
    secret: '',
    mfaRequired: false,
    whitelist: [ '0.0.0.0/0' ]
  },
  api: {
    enabled: true,
    port: 1389,
    serveStatic: 'dist'
  },
  sessions: {
    ttl: 86400000, // 24h
    sync: false,
    file: 'dapper.sessions.json',
    mfaRequired: false,
    shared: true
  },
  authentication: { provider: 'internal' },
  datastore: { provider: 'memory' }
};

function Dapper(config = {}) {
  const self = this;

  //////////

  self.version = require('../package.json').version;
  self.config = Object.$merge(defaults, config, true);

  //////////

  self.util = require('./util')(self);
  self.models = require('./models')(self);
  self.auth = require('./authentication')(self);
  self.store = require('./datastore')(self);
  self.sessions = require('./sessions')(self);

  self.apiServer = require('./apiServer')(self);
  self.ldapServer = require('./ldapServer')(self);
  self.radiusServer = require('./radiusServer')(self);

  //////////

  self.tree = self.models.tree();

  //////////

  self.boot = function(callback) {
    callback = self.util.callback(callback);

    self.store.populate(self.tree, () => {
      async.series([
        self.sessions.boot,
        self.apiServer.boot,
        self.ldapServer.boot,
        self.radiusServer.boot
      ], callback);
    });
  };

  self.shutdown = function(callback) {
    callback = self.util.callback(callback);

    async.series([
      self.sessions.shutdown,
      self.apiServer.shutdown,
      self.ldapServer.shutdown,
      self.radiusServer.shutdown
    ], callback);
  };

  process.on('SIGINT', self.shutdown);

  //////////

  return self;
}

module.exports = Dapper;
