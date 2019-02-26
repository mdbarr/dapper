'use strict';

const ldap = require('@mdbarr/ldapjs');

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

      if (!user || user.object !== 'ldapUser') {
        return next(new ldap.InsufficientAccessRightsError());
      }

      const model = dapper.tree.models.index[user.id];

      if (req instanceof ldap.BindRequest) {
        if (!req.credentials || !model || !model.password ||
            !dapper.util.validatePassword(req.credentials, model.password)) {
          return next(new ldap.InvalidCredentialsError());
        }
      }

      req.authorization = {
        id: user.id,
        dn,
        user,
        model
      };

      console.debug('AUTHORIZE SUCCESS');
      return next();
    }

    return next(new ldap.InvalidCredentialsError());
  };

  //////////

  self.bind = function(req, res, next) {
    console.debug(req);

    console.debug('BIND SUCCESS: ' + req.dn.toString() + ' / ' + req.credentials);

    res.end();
    return next();
  };

  //////////

  self.search = function(req, res, next) {
    const dn = req.dn.toString();

    if (!dapper.tree.ldap.binds.has(dn) && !dapper.tree.ldap.dns.has(dn)) {
      return next(new ldap.NoSuchObjectError(dn));
    }

    console.debug('SEARCH REQUEST ' + dn + ' / ' + req.scope);

    switch (req.scope) {
      case 'base':
        const object = dapper.tree.ldap.dns.get(dn);

        const base = {
          dn: dn,
          attributes: object.attributes
        };

        console.debug('search: ' + req.filter.matches(base.attributes));

        if (req.filter.matches(base.attributes)) {
          res.send(base);
        }
        res.end();
        return next();
      case 'one':
      case 'sub':
        break;
    }

    res.end();
    return next();
  };

  //////////

  self.bindings = new Set();

  self.setBindings = function() {
    dapper.tree.ldap.binds.forEach(function(model, binding) {
      if (!self.bindings.has(binding)) {
        dapper.ldap.bind(binding, self.authorize, self.bind);

        dapper.ldap.search(binding, self.authorize, self.search);

        self.bindings.add(binding);
      }
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
