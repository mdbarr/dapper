'use strict';

const ldap = require('@mdbarr/ldapjs');

function LDAPServer(dapper) {
  const self = this;

  dapper.ldap = ldap.createServer();

  //////////

  self.whitelist = dapper.util.nop;

  self.authorize = function(req, res, next) {
    let dn;

    if (!self.whitelist(req.connection.remoteAddress)) {
      return next(new ldap.InvalidCredentialsError());
    }

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

      if (model.attributes.accountLocked || model.attributes.passwordResetRequired) {
        return next(new ldap.InvalidCredentialsError());
      }

      if (req instanceof ldap.BindRequest) {
        if (!req.credentials || !model || !model.password) {
          return next(new ldap.InvalidCredentialsError());
        }

        if (dapper.util.mfaRequired(dn, model)) {
          if (!model.attributes.mfaEnabled) {
            return next(new ldap.InvalidCredentialsError());
          }

          if (!dapper.util.validatePasswordMFA(req.credentials, model.password, model.mfa)) {
            return next(new ldap.InvalidCredentialsError());
          }
        } else if (!dapper.util.validatePassword(req.credentials, model.password)) {
          return next(new ldap.InvalidCredentialsError());
        }
      } else if (req instanceof ldap.SearchRequest) {
        if (!model.permissions.search) {
          return next(new ldap.InsufficientAccessRightsError());
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

  function checkScope(req, dn) {
    if (req.scope === 'one') {
      if (req.dn.equals(dn)) {
        return true;
      } else {
        const parent = ldap.parseDN(dn).parent();
        return (parent ? parent.equals(req.dn) : false);
      }
    } else if (req.scope === 'sub') {
      return (req.dn.equals(dn) || req.dn.parentOf(dn));
    }
    return false;
  }

  self.search = function(req, res, next) {
    const dn = req.dn.toString();

    if (!dapper.tree.ldap.binds.has(dn) && !dapper.tree.ldap.dns.has(dn)) {
      return next(new ldap.NoSuchObjectError(dn));
    }

    console.debug('SEARCH REQUEST ' + dn + ' / ' + req.scope);

    if (req.scope === 'base') {
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
    } else if (req.scope === 'one' || req.scope === 'sub') {
      const seen = new Set();
      dapper.tree.ldap.dns.forEach(function(object, key) {
        if (checkScope(req, key)) {
          if (req.filter.matches(object.attributes) && !seen.has(object)) {
            res.send({
              dn: key,
              attributes: object.attributes
            });

            seen.add(object);
          }
        }
      });

      res.end();
      return next();
    }
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

    if (!dapper.config.ldap.enabled) {
      return callback();
    }

    self.whitelist = dapper.util.whitelist(dapper.config.ldap.whitelist);

    self.setBindings();

    dapper.ldap.listen(dapper.config.ldap.port, '0.0.0.0', function() {
      console.log('Dapper LDAP server listening at: ' + dapper.ldap.url);
      callback();
    });
  };

  self.shutdown = function(callback) {
    callback = dapper.util.callback(callback);

    if (!dapper.config.ldap.enabled) {
      return callback();
    }

    dapper.ldap.close(callback);
  };

  //////////

  return self;
};

module.exports = function(dapper) {
  return new LDAPServer(dapper);
};
