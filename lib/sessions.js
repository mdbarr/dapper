'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const errors = require('restify-errors');

function Sessions (dapper) {
  const self = this;

  const sessions = new Map();
  const users = new Map();

  self.intervals = {
    ttl: 0,
    sync: 0
  };

  let syncFile;

  self.create = function (user) {
    let session;

    if (dapper.config.sessions.shared && users[user.id]) {
      session = users[user.id];
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
        if (count && dapper.config.options.verbose) {
          console.log(`[sessions] ${ count } saved sessions loaded`);
        }
      }
    } catch (error) {
      console.log('[sessions] error loading saved sessions', error);
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
        if (dapper.config.options.verbose) {
          console.log('[sessions] active sessions saved to disk');
        }
        return callback();
      });
    }
    return callback();
  };

  ///////////

  self.login = function (req, res, next) {
    if (!req.body || !req.body.username || !req.body.password) {
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
      return next(new errors.UnauthorizedError('Invalid username or password'));
    }

    if (!user.permissions.session) {
      return next(new errors.ForbiddenError('Session based login forbidden'));
    }

    const mfaRequired = dapper.config.sessions.mfaRequired;

    return dapper.auth.authenticate({
      user,
      password,
      mfaRequired
    }, (authenticated) => {
      if (!authenticated) {
        return next(new errors.UnauthorizedError('Invalid username or password'));
      }

      req.authorization = {
        user,
        session: dapper.sessions.create(user)
      };

      return next();
    });
  };

  self.validate = function (req, res, next) {
    let id;
    let type = 'none';
    if (req.headers && req.headers.authorization) {
      type = 'bearer';
      id = req.headers.authorization.replace('Bearer ', '');
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

    console.log(`[auth/${ type }] validating ${ id }`);

    if (!id) {
      return next(new errors.UnauthorizedError('Invalid session'));
    }

    const session = self.lookup(id);
    if (!session) {
      return next(new errors.UnauthorizedError('Invalid session'));
    }

    session.timestamp = dapper.util.timestamp();

    req.authorization.user = dapper.tree.models.index[session.user];
    req.authorization.session = session;

    return next();
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
    console.log('Dapper Session Engine started.');
    callback();
  };

  self.shutdown = function (callback) {
    callback = dapper.util.callback(callback, true);

    clearInterval(self.intervals.ttl);
    clearInterval(self.intervals.sync);

    if (dapper.config.sessions.sync) {
      return self.sync(() => {
        return callback();
      });
    }
    return callback();
  };

  ///////////

  return self;
}

module.exports = function (dapper) {
  return new Sessions(dapper);
};
