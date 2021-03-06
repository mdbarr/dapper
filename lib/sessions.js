'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const errors = require('restify-errors');

function Sessions (dapper) {
  const self = this;

  self.log = dapper.log.child({ service: 'sessions' });

  const sessions = new Map();
  const users = new Map();

  self.intervals = {
    ttl: 0,
    sync: 0,
  };

  let syncFile;

  self.create = function (user) {
    let session;

    if (dapper.config.sessions.shared && users.has(user.id)) {
      session = users.get(user.id);
      session.timestamp = dapper.util.timestamp();
    } else {
      session = dapper.models.session(user);
      sessions.set(session.id, session);
      users.set(user.id, session);
    }

    return session;
  };

  //////////

  self.lookup = function (id) {
    if (sessions.has(id)) {
      return sessions.get(id);
    }
    return null;
  };

  self.clear = function (id) {
    if (sessions.has(id)) {
      sessions.delete(id);
    }
  };

  self.expire = function () {
    const now = Date.now();
    sessions.forEach((session, id) => {
      if (now - session.timestamp > dapper.config.sessions.ttl) {
        users.delete(session.user);
        sessions.delete(id);
      }
    });
  };

  //////////

  self.load = function () {
    try {
      if (fs.existsSync(syncFile)) {
        let count = 0;
        const data = fs.readFileSync(syncFile);
        if (data) {
          const items = JSON.parse(data);

          for (const id in items) {
            const session = items[id];
            sessions.set(id, session);
            users.set(session.user, session);
            count++;
          }
        }
        if (count) {
          self.log.info(`${ count } saved sessions loaded`);
        }
      }
    } catch (error) {
      self.log.error('error loading saved sessions', error);
    }
  };

  self.sync = function (callback) {
    callback = dapper.util.callback(callback);
    if (syncFile) {
      const items = {};
      for (const [ key, value ] of sessions) {
        items[key] = value;
      }

      const data = JSON.stringify(items);

      return fs.writeFile(syncFile, data, () => {
        self.log.debug('active sessions saved to disk');
        return callback();
      });
    }
    return callback();
  };

  ///////////

  self.login = function (req, res, next) {
    if (!req.body || !req.body.username || !req.body.password) {
      res.clearCookie(dapper.config.api.cookie);
      return next(new errors.UnauthorizedError('Invalid username or password'));
    }

    const username = req.body.username || '';
    const password = req.body.password || '';

    let user;
    if (username.includes('@')) {
      user = dapper.tree.models.emails[username];
    } else {
      user = dapper.tree.models.users[username];
    }

    if (!user) {
      res.clearCookie(dapper.config.api.cookie);
      return next(new errors.UnauthorizedError('Invalid username or password'));
    }

    if (!user.permissions.session) {
      res.clearCookie(dapper.config.api.cookie);
      return next(new errors.ForbiddenError('Session based login forbidden'));
    }

    const mfaRequired = dapper.config.sessions.mfaRequired;

    return dapper.auth.authenticate({
      user,
      password,
      mfaRequired,
    }, (authenticated) => {
      if (!authenticated) {
        res.clearCookie(dapper.config.api.cookie);
        return next(new errors.UnauthorizedError('Invalid username or password'));
      }

      req.authorization = {
        user,
        session: dapper.sessions.create(user),
      };

      return next();
    });
  };

  self.logout = function(req, res, next) {
    dapper.sessions.clear(req.authorization.session.id);
    res.clearCookie(dapper.config.api.cookie);
    res.send(204);
    next();
  };

  self.validate = function (req, res, next) {
    let id = null;
    let type = 'none';
    if (req.headers && req.headers.authorization) {
      type = 'bearer';
      id = req.headers.authorization.toLowerCase().replace('bearer ', '');
    } else if (req.cookies && req.cookies[dapper.config.api.cookie]) {
      type = 'cookie';
      id = req.cookies[dapper.config.api.cookie];
    } else if (req.query && req.query.id) {
      type = 'query';
      id = req.query.id;
    } else if (req.params && req.params.id) {
      type = 'param';
      id = req.params.id;
    }

    self.log.verbose(`validating ${ type }/${ id }`);

    if (!id) {
      res.clearCookie(dapper.config.api.cookie);
      return next(new errors.UnauthorizedError('Invalid session'));
    }

    const session = self.lookup(id);
    if (!session) {
      res.clearCookie(dapper.config.api.cookie);
      return next(new errors.UnauthorizedError('Invalid session'));
    }

    self.log.verbose(`authorized ${ type }/${ id }`);

    session.timestamp = dapper.util.timestamp();

    req.authorization.user = dapper.tree.models.index[session.user];
    req.authorization.session = session;

    return next();
  };

  self.administrator = function (req, res, next) {
    return self.validate(req, res, (error) => {
      if (error) {
        return next(error);
      }

      if (!req.authorization.user.permissions.administrator) {
        return next(new errors.UnauthorizedError('Administrator credentials required'));
      }

      return next();
    });
  };

  self.expand = function(req, res, next) {
    const response = Object.assign({}, req.authorization.session);
    response.user = dapper.util.sanitize(req.authorization.user);

    res.setCookie(dapper.config.api.cookie, req.authorization.session.id);
    res.send(200, response);
    next();
  };

  //////////

  self.boot = function (callback) {
    callback = dapper.util.callback(callback, true);
    self.intervals.ttl = setInterval(self.expire, dapper.config.sessions.ttl);

    if (dapper.config.sessions.sync && dapper.config.sessions.file) {
      syncFile = path.join(os.tmpdir(), dapper.config.sessions.file);
      self.load();

      self.intervals.sync = setInterval(self.sync, dapper.config.sessions.sync);
    }
    self.log.info('Session Engine started.');
    callback();
  };

  self.shutdown = function (callback) {
    callback = dapper.util.callback(callback, true);

    clearInterval(self.intervals.ttl);
    clearInterval(self.intervals.sync);

    if (dapper.config.sessions.sync) {
      return self.sync(() => callback());
    }
    return callback();
  };

  ///////////

  return self;
}

module.exports = function (dapper) {
  return new Sessions(dapper);
};
