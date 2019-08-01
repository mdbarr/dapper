'use strict';

module.exports = {
  object: 'config',
  options: {
    addEmailDomains: false, // add individual email domains to global domain list
    parseEmailToDC: true, // parse email addresses as individual additional DCs
    allowEmpty: true, // allow empty fields for normal branches in the tree (dc, o)
    allowPlainTextPasswords: false // allow unhashed passwords
  },
  logs: {
    console: 'info',
    file: 'info',
    filename: 'dapper.log'
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
    access: {
      order: 'deny, allow',
      allow: [ '0.0.0.0/0' ],
      deny: []
    }
  },
  metadata: {
    domains: {
      publish: [],
      defaults: {}
    },
    organizations: {
      publish: [],
      defaults: {}
    },
    groups: {
      publish: [],
      defaults: {}
    },
    users: {
      publish: [],
      defaults: []
    }
  },
  radius: {
    enabled: true,
    port: 'auto', // (1812)
    secret: '',
    mfaRequired: false,
    keys: [ 'username', 'email' ],
    access: {
      order: 'deny, allow',
      allow: [ '0.0.0.0/0' ],
      deny: []
    }
  },
  api: {
    enabled: true,
    port: 'auto',
    serveStatic: 'dist',
    cookie: 'dapper-session',
    access: {
      order: 'deny, allow',
      allow: [ '0.0.0.0/0' ],
      deny: []
    }
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