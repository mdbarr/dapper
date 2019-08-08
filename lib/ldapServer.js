'use strict';

const ldap = require('@mdbarr/ldapjs');
const AccessControl = require('../utils/accessControl');

const LDAP_DEFAULT_PORT = 389;
const LDAPS_DEFAULT_PORT = 636;

function LDAPServer(dapper) {
  const self = this;

  //////////

  self.log = dapper.log.child({ service: 'ldap' });

  self.authorize = function(req, res, next) {
    let dn;

    if (!self.access.check(req.connection.remoteAddress)) {
      return next(new ldap.InvalidCredentialsError());
    }

    if (req instanceof ldap.BindRequest) {
      dn = req.dn.toString();
    } else if (req instanceof ldap.SearchRequest) {
      dn = req.connection.ldap.bindDN.toString();
    } else {
      return next(new ldap.InsufficientAccessRightsError());
    }

    if (!dn) {
      return next(new ldap.UnwillingToPerformError());
    }

    if (dapper.tree.ldap.dns.has(dn)) {
      const user = dapper.tree.ldap.dns.get(dn);

      if (!user || user.object !== 'ldapUser') {
        return next(new ldap.InsufficientAccessRightsError());
      }

      const model = dapper.tree.models.index[user.id];

      if (req instanceof ldap.BindRequest) {
        if (!req.credentials || !model || !model.permissions.bind) {
          return next(new ldap.InvalidCredentialsError());
        }

        const mfaRequired = dapper.util.mfaRequired(dn, model);

        return dapper.auth.authenticate({
          user: model,
          password: req.credentials,
          mfaRequired
        }, (authenticated) => {
          if (!authenticated) {
            return next(new ldap.InvalidCredentialsError());
          }

          req.authorization = {
            id: user.id,
            dn,
            user,
            model
          };

          return next();
        });
      } else if (req instanceof ldap.SearchRequest) {
        if (!model.permissions.search) {
          return next(new ldap.InsufficientAccessRightsError());
        }
      }
      return next();
    }

    return next(new ldap.InvalidCredentialsError());
  };

  //////////

  self.bind = function(req, res, next) {
    self.log.verbose(`bind: ${ req.dn.toString() }`);

    res.end();
    return next();
  };

  //////////

  function checkScope(req, dn) {
    if (req.scope === 'one') {
      if (req.dn.equals(dn)) {
        return true;
      }
      const parent = ldap.parseDN(dn).parent();
      return parent ? parent.equals(req.dn) : false;
    } else if (req.scope === 'sub') {
      return req.dn.equals(dn) || req.dn.parentOf(dn);
    }
    return false;
  }

  self.search = function(req, res, next) {
    const dn = req.dn.toString();

    self.log.verbose(`search: ${ dn } / ${ req.scope } / ${ req.filter.toString() }`);

    if (!dapper.tree.ldap.binds.has(dn) && !dapper.tree.ldap.dns.has(dn)) {
      return next(new ldap.NoSuchObjectError(dn));
    }

    const results = [];

    if (req.scope === 'base') {
      const object = dapper.tree.ldap.dns.get(dn);

      if (object) {
        const base = {
          dn,
          attributes: object.attributes
        };

        self.log.debug(`search: ${ req.filter.matches(base.attributes) }`);

        if (req.filter.matches(base.attributes)) {
          results.push(base);
        }
      }
    } else if (req.scope === 'one' || req.scope === 'sub') {
      const seen = new Set();

      for (const [ key, object ] of dapper.tree.ldap.dns) {
        if (checkScope(req, key)) {
          if (req.filter.matches(object.attributes) && !seen.has(object)) {
            seen.add(object);

            results.push({
              dn: key,
              attributes: object.attributes
            });
          }
        }
      }
    }

    let paged = false;
    let pageSize = 0;
    let cookie = false;

    req.controls.forEach((control) => {
      if (control.type === ldap.PagedResultsControl.OID) {
        paged = true;
        pageSize = control.value.size;
        cookie = control.value.cookie;
      }
    });

    if (paged) {
      const min = 0;
      const max = results.length;

      function pageResults(start, end) {
        let i;
        start = start < min ? min : start;
        end = end > max || end < min ? max : end;
        for (i = start; i < end; i++) {
          res.send(results[i]);
        }
        return i;
      }

      if (cookie && Buffer.isBuffer(cookie)) {
        let first = min;
        if (cookie.length !== 0) {
          first = parseInt(cookie.toString(), 10);
        }
        const last = pageResults(first, first + pageSize);

        let resultCookie;
        if (last < max) {
          resultCookie = new Buffer(last.toString());
        } else {
          resultCookie = new Buffer('');
        }

        res.controls.push(new ldap.PagedResultsControl({ value: {
          size: max,
          cookie: resultCookie
        } }));
      }

      res.end();
      return next();
    }

    const limit = req.sizeLimit || Infinity;
    let count = 0;

    for (const item of results) {
      res.send(item);
      count++;

      if (count > limit) {
        res.end(ldap.LDAP_SIZE_LIMIT_EXCEEDED);
        return next();
      }
    }
    res.end();
    return next();
  };

  //////////

  self.bindings = new Set();

  self.setBindings = function() {
    dapper.tree.ldap.binds.forEach((binding) => {
      if (!self.bindings.has(binding)) {
        dapper.ldap.bind(binding, self.authorize, self.bind);

        dapper.ldap.search(binding, self.authorize, self.search);

        self.bindings.add(binding);
      }
    });

    dapper.ldap.search('', self.authorize, (req, res, next) => {
      res.send({
        dn: '',
        attributes: { objectClass: [ 'top', 'dapper' ] }
      });

      res.end();
      next();
    });
  };

  //////////

  self.boot = function(callback) {
    callback = dapper.util.callback(callback);

    if (!dapper.config.ldap.enabled) {
      return callback();
    }

    if (dapper.config.ldap.certificate && dapper.config.ldap.key) {
      dapper.config.ldap.certificate = dapper.util.readPEM(dapper.config.ldap.certificate);
      dapper.config.ldap.key = dapper.util.readPEM(dapper.config.ldap.key);
    }

    dapper.ldap = ldap.createServer({
      certificate: dapper.config.ldap.certificate,
      key: dapper.config.ldap.key
    });

    self.access = new AccessControl(dapper.config.ldap.access);

    if (dapper.config.ldap.port === 'auto') {
      if (dapper.config.ldap.certificate && dapper.config.ldap.key) {
        dapper.config.ldap.port = LDAPS_DEFAULT_PORT;
      } else {
        dapper.config.ldap.port = LDAP_DEFAULT_PORT;
      }
    }

    self.setBindings();

    return dapper.ldap.listen(dapper.config.ldap.port, '0.0.0.0', () => {
      if (dapper.config.ldap.port === 0) {
        dapper.config.ldap.port = dapper.ldap.address().port;
      }

      self.log.info(`LDAP server listening at: ${ dapper.ldap.url }`);
      callback();
    });
  };

  self.shutdown = function(callback) {
    callback = dapper.util.callback(callback);

    if (!dapper.config.ldap.enabled) {
      return callback();
    }

    return dapper.ldap.close(callback);
  };

  //////////

  return self;
}

module.exports = function(dapper) {
  return new LDAPServer(dapper);
};
