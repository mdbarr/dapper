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
        'QA', 'Dev', 'Product'
      ],
      groups: [ {
        name: 'Admin',
        organization: 'Dev'
      } ],
      users: [ {
        username: 'foo',
        password: 'secure',
        mfa: 'JBLFQSDWGJGTG2SPLJEEMVTCG42GC2TR',
        name: 'Fooey McTest',
        email: 'foo@dapper.test',
        organizations: [ 'QA', 'Dev' ],
        groups: [ 'Admin' ],
        permissions: {
          search: false
        }
      }, {
        username: 'bar',
        password: 'secret',
        mfa: 'OQZEUKZPJB5DINCRJBXDS5SRJRMVUVLI',
        name: 'Barley Testerly',
        email: 'bar@dapper.test',
        organizations: [ 'Dev' ]
      } ]
    }
  }
};
