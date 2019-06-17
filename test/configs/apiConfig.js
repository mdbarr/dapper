'use strict';

module.exports = {
  options: { allowPlainTextPasswords: true },
  logs: { console: 'error' },
  radius: { enabled: false },
  ldap: { enabled: false },
  api: {
    port: 0,
    enabled: true
  },
  sessions: {
    sync: false,
    mfaRequired: false,
    shared: true
  },
  datastore: {
    provider: 'memory',
    data: {
      domains: [
        'dapper.test'
      ],
      organizations: [
        'QA', 'Dev', 'Product'
      ],
      groups: [ {
        name: 'Admin',
        organization: 'Dev'
      } ],
      users: [ {
        username: 'foo',
        password: 'password',
        name: 'Fooey',
        email: 'foo@dapper.test',
        permissions: { administrator: true },
        organizations: [ 'QA', 'Dev' ],
        groups: [ 'Admin' ]
      } ]
    }
  }
};
