'use strict';

const ldap = require('ldapjs');

function Dapper() {
  const self = this;

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
