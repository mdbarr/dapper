'use strict';

module.exports = {
  options: {
    parseEmailToDC: true,
    allowEmpty: true
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
    port: 389,
    requireAuthentication: false,
    bindDNs: []
  },
  api: {
    port: 1389
  },
  datastore: {
    provider: 'memory',
    data: {
      domains: [
        'dapper.test'
      ],
      organizations: [
        'qa', 'dev', 'product'
      ],
      groups: [
        'admins'
      ],
      users: [ {
        username: 'foo',
        password: 'password',
        name: 'Fooey',
        email: 'foo@dapper.test'
      } ]
    }
  }
};
