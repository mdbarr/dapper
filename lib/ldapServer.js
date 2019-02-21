'use strict';

const ldap = require('ldapjs');

function LDAPServer(dapper) {
  const self = this;

  dapper.ldap = ldap.createServer();

  //////////

  self.authorize = function(req, res, next) {
    const dn = req.dn.toString();

    console.pp(dn);
    console.log(dapper.tree.ldap.dns.has(dn));

    if (dapper.tree.ldap.dns.has(dn)) {
      const model = dapper.tree.ldap.dns.get(dn);

      if (model.object !== 'ldapUser') {
        return next(new ldap.InsufficientAccessRightsError());
      }

      if (!req.credentials || !model.attributes || !model.attributes.userPassword ||
          !dapper.util.validatePassword(req.credentials, model.attributes.userPassword)) {
        return next(new ldap.InvalidCredentialsError());
      }

      console.log('here');

      return next();
    }

    return next(new ldap.InvalidCredentialsError());
  };

  //////////

  self.bind = function(req, res, next) {
    console.debug(req);

    console.pp('BIND REQUEST: ' + req.dn.toString() + ' / ' + req.credentials);

    res.end();
    return next();
  };

  //////////

  self.setBindings = function() {
    const bindings = new Set();
    dapper.tree.ldap.binds.forEach(function(model, binding) {
      dapper.ldap.bind(binding, self.authorize, self.bind);
      bindings.add(binding);
    });
  };

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
