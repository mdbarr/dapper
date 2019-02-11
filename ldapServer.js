'use strict';

const ldap = require('ldapjs');

function LDAPServer(dapper) {
  const self = this;

  dapper.ldap = ldap.createServer();

  return self;
};

module.exports = function(dapper) {
  return new LDAPServer(dapper);
};
