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
        'QA', 'Dev', 'Product',
        {
          name: 'VPN',
          options: {
            mfaRequired: true
          }
        }
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
        organizations: [ 'Dev', 'VPN' ],
        attributes: {
          mfaEnabled: true
        }
      }, {
        username: 'baz',
        password: '12345',
        mfa: 'I54FGVDNGNGTEM3GOA3G2YKSKN3XQ33G',
        name: 'Bazman Testlington',
        email: 'baz@dapper.test',
        organizations: [ 'Product' ],
        attributes: {
          accountLocked: true
        }
      } ]
    }
  }
};
