'use strict';

require('barrkeep');
const ldap = require('ldapjs');

const defaults = {
  tree: {
    ordering: [ 'dc', 'o', 'ou' ]
  },
  users: {
    ou: 'Users',
    type: 'inetOrgPerson'
  },
  groups: {
    ou: 'Groups',
    type: 'groupOfNames'
  },
  ldap: {
    port: 389,
    requireAuthentication: false,
    bindDNs: []
  }
};

function Dapper(config = {}) {
  const self = this;

  //////////

  self.config = Object.merge(defaults, config);

  //////////

  self.models = require('./models');

  self.ldap = ldap.createServer();

  //////////

  self.boot = function() {
    self.ldap.listen(389, '0.0.0.0', function() {
      console.log('Dapper server listening at: ' + self.ldap.url);
    });
  };

  //////////

  return self;
}

module.exports = Dapper;
