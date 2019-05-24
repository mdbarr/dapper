'use strict';

module.exports = {
  radius: { enabled: false },
  ldap: { enabled: false },
  api: { enabled: true },
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
        organizations: [ 'QA', 'Dev' ],
        groups: [ 'Admin' ]
      } ]
    }
  }
};
