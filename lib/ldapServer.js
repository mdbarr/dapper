'use strict';

const ldap = require('ldapjs');

function LDAPServer(dapper) {
  const self = this;

  dapper.ldap = ldap.createServer();

  //////////

  self.boot = function() {
    dapper.ldap.listen(dapper.config.ldap.port, '0.0.0.0', function() {
      console.log('Dapper server listening at: ' + dapper.ldap.url);
    });
  };

  return self;
};

module.exports = function(dapper) {
  return new LDAPServer(dapper);
};
