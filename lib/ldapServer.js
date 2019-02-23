'use strict';

const ldap = require('ldapjs');

function LDAPServer(dapper) {
  const self = this;

  dapper.ldap = ldap.createServer();

  //////////

  self.authorize = function(req, res, next) {
    let dn;

    if (req instanceof ldap.BindRequest) {
      dn = req.dn.toString();
    } else if (req instanceof ldap.SearchRequest) {
      dn = req.connection.ldap.bindDN.toString();
    } else {
      return next(new ldap.InsufficientAccessRightsError());
    }

    if (dapper.tree.ldap.dns.has(dn)) {
      const user = dapper.tree.ldap.dns.get(dn);

      if (user.object !== 'ldapUser') {
        return next(new ldap.InsufficientAccessRightsError());
      }

      if (!req.credentials || !user.attributes || !user.attributes.userPassword ||
          !dapper.util.validatePassword(req.credentials, user.attributes.userPassword)) {
        return next(new ldap.InvalidCredentialsError());
      }

      const model = dapper.tree.models.index[user.id];

      req.authorization = {
        id: user.id,
        dn,
        user,
        model
      };

      return next();
    }

    return next(new ldap.InvalidCredentialsError());
  };

  //////////

  self.bind = function(req, res, next) {
    console.debug(req);

    console.pp('BIND SUCCESS: ' + req.dn.toString() + ' / ' + req.credentials);

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
