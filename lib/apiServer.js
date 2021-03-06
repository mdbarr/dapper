'use strict';

const restify = require('restify');
const errors = require('restify-errors');
const cookieParser = require('restify-cookies');
const AccessControl = require('../utils/accessControl');
const corsMiddleware = require('restify-cors-middleware');

const API_DEFAULT_PORT = 1389;

function APIServer (dapper) {
  const self = this;

  //////////

  self.log = dapper.log.child({ service: 'api' });

  dapper.api = restify.createServer({
    name: 'Dapper API server',
    ignoreTrailingSlash: true,
    strictNext: true,
  });

  //////////

  const cors = corsMiddleware({
    origins: [ '*' ],
    allowHeaders: [ 'Authorization' ],
    exposeHeaders: [ 'Authorization' ],
  });

  dapper.api.pre(cors.preflight);
  dapper.api.use(cors.actual);

  //////////

  dapper.api.use(restify.pre.sanitizePath());
  dapper.api.pre(restify.plugins.pre.dedupeSlashes());
  dapper.api.use(restify.plugins.dateParser());
  dapper.api.use(restify.plugins.queryParser());
  dapper.api.use(restify.plugins.bodyParser());
  dapper.api.use(restify.plugins.authorizationParser());
  dapper.api.use(cookieParser.parse);

  dapper.api.use((req, res, next) => {
    res.header('dapper-version', dapper.version);

    const remote = req.headers['x-real-ip'] ||
          req.headers['x-forwarded-for'] ||
          req.connection.remoteAddress;

    if (!self.access.check(remote)) {
      return next(new errors.UnauthorizedError('Unauthorized access'));
    }

    self.log.verbose(`${ req.method } ${ req.url } - ${ remote }`);

    return next();
  });

  //////////

  function serverStatic (directory) {
    dapper.api.get('/*', restify.plugins.serveStatic({
      directory: `./${ directory }`,
      default: 'index.html',
    }));

    dapper.api.get('/css/*', restify.plugins.serveStatic({
      directory: `./${ directory }/css`,
      appendRequestPath: false,
    }));

    dapper.api.get('/fonts/*', restify.plugins.serveStatic({
      directory: `./${ directory }/fonts`,
      appendRequestPath: false,
    }));

    dapper.api.get('/img/*', restify.plugins.serveStatic({
      directory: `./${ directory }/img`,
      appendRequestPath: false,
    }));

    dapper.api.get('/js/*', restify.plugins.serveStatic({
      directory: `./${ directory }/js`,
      appendRequestPath: false,
    }));
  }

  //////////

  dapper.api.post('/api/session', dapper.sessions.login, dapper.sessions.expand);

  dapper.api.get('/api/session', dapper.sessions.validate, dapper.sessions.expand);

  dapper.api.del('/api/session', dapper.sessions.validate, dapper.sessions.logout);

  //////////

  dapper.api.get('/api/datastore', dapper.sessions.administrator, (req, res, next) => {
    res.send(200, dapper.store.describe());
    next();
  });

  //////////

  dapper.api.get('/api/domains', dapper.sessions.administrator, (req, res, next) => {
    const result = {
      items: [],
      count: 0,
    };

    for (const id in dapper.tree.models.domains) {
      const model = dapper.tree.models.domains[id];

      const domain = {
        id: model.id,
        domain: model.domain,
      };

      result.items.push(domain);
    }
    result.count = result.items.length;

    res.send(200, result);
    next();
  });

  dapper.api.get('/api/organizations', dapper.sessions.administrator, (req, res, next) => {
    const result = {
      items: [],
      count: 0,
    };

    for (const id in dapper.tree.models.organizations) {
      const model = dapper.tree.models.organizations[id];

      const organization = {
        id: model.id,
        name: model.name,
      };

      result.items.push(organization);
    }
    result.count = result.items.length;

    res.send(200, result);
    next();
  });

  dapper.api.get('/api/groups', dapper.sessions.administrator, (req, res, next) => {
    const result = {
      items: [],
      count: 0,
    };

    for (const id in dapper.tree.models.groups) {
      const model = dapper.tree.models.groups[id];

      const group = {
        id: model.id,
        name: model.name,
      };

      result.items.push(group);
    }
    result.count = result.items.length;

    res.send(200, result);
    next();
  });

  dapper.api.get('/api/users', dapper.sessions.administrator, (req, res, next) => {
    const result = {
      items: [],
      count: 0,
    };

    for (const id in dapper.tree.models.users) {
      const model = dapper.tree.models.users[id];

      const user = {
        id: model.id,
        name: model.name,
        username: model.username,
        email: model.email,
      };

      result.items.push(user);
    }
    result.count = result.items.length;

    res.send(200, result);
    next();
  });

  //////////

  self.boot = function(callback) {
    callback = dapper.util.callback(callback);

    if (!dapper.config.api.enabled) {
      return callback();
    }

    if (dapper.config.api.port === 'auto') {
      dapper.config.api.port = API_DEFAULT_PORT;
    }

    if (dapper.config.api.serveStatic) {
      serverStatic(dapper.config.api.serveStatic);
    }

    self.access = new AccessControl(dapper.config.api.access);

    return dapper.api.listen(dapper.config.api.port, (error) => {
      if (error) {
        return callback(error);
      }

      if (dapper.config.api.port === 0) {
        dapper.config.api.port = dapper.api.address().port;
      }

      self.log.info(`API server listening on http://0.0.0.0:${ dapper.config.api.port }`);
      return callback();
    });
  };

  self.shutdown = function(callback) {
    callback = dapper.util.callback(callback);

    if (!dapper.config.api.enabled) {
      return callback();
    }

    return dapper.api.close(callback);
  };

  //////////

  return self;
}

module.exports = function(dapper) {
  return new APIServer(dapper);
};
