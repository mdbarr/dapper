'use strict';

const ldap = require('ldapjs');

function LDAPServer(dapper) {
  const self = this;

  dapper.ldap = ldap.createServer();

  //////////

  self.binder = function(req, res, next) {
    console.debug(req);

    console.pp('BIND REQUEST: ' + req.dn.toString() + ' / ' + req.credentials);

    res.end();
    return next();
  };

  self.setBindings = function() {
    const bindings = new Set();
    dapper.tree.ldap.binds.forEach(function(model, binding) {
      dapper.ldap.bind(binding, self.binder);
      bindings.add(binding);
    });
  };

  //////////

  self.boot = function(callback) {
    callback = dapper.util.callback(callback);

    self.setBindings();

    dapper.ldap.listen(dapper.config.ldap.port, '0.0.0.0', function() {
      console.log('Dapper server listening at: ' + dapper.ldap.url);
      callback();
    });
  };

  self.shutdown = function(callback) {
    callback = dapper.util.callback(callback);

    dapper.ldap.close(function() {
      callback();
    });
  };

  //////////

  return self;
};

module.exports = function(dapper) {
  return new LDAPServer(dapper);
};
