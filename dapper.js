'use strict';

require('barrkeep');
const ldap = require('ldapjs');

const defaults = {
  tree: {
    ordering: [ 'dc', 'o', 'ou' ]
  },
  users: {
    ou: 'Users',
    type: 'inetOrgPerson',
    groupMembership: 'memberOf'
  },
  groups: {
    ou: 'Groups',
    type: 'groupOfNames',
    memberAttribute: 'member'
  },
  ldap: {
    port: 389, // 'auto'
    requireAuthentication: false,
    bindDNs: []
  }
};

function Dapper(config = {}) {
  const self = this;

  //////////

  self.config = Object.merge(defaults, config);

  //////////

  self.util = require('./util');
  self.models = require('./models');

  self.ldap = ldap.createServer();

  //////////

  self.boot = function() {
    self.ldap.listen(self.config.ldap.port, '0.0.0.0', function() {
      console.log('Dapper server listening at: ' + self.ldap.url);
    });
  };

  //////////

  return self;
}

module.exports = Dapper;
