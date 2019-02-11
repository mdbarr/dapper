'use strict';

require('barrkeep');

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

  self.version = require('./package.json').version;
  self.config = Object.merge(defaults, config);

  //////////

  self.util = require('./util')(self);
  self.models = require('./models')(self);

  self.apiServer = require('./apiServer')(self);
  self.ldapServer = require('./ldapServer')(self);

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
