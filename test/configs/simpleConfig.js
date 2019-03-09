'use strict';

module.exports = {
  radius: { secret: 'secure' },
  api: { enabled: false },
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
