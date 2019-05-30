'use strict';

const restify = require('restify');
const cookieParser = require('restify-cookies');

const API_DEFAULT_PORT = 1389;

const API_CORS_METHODS = [
  'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'
].join(', ');

const API_CORS_HEADERS = [
  'Access-Control-Allow-Headers', 'Origin',
  'Accept', 'X-Requested-With', 'Content-Type',
  'Access-Control-Request-Method',
  'Access-Control-Request-Headers',
  'Authorization'
].join(', ');

function APIServer(dapper) {
  const self = this;

  dapper.api = restify.createServer({
    name: 'Dapper API server',
    ignoreTrailingSlash: true,
    strictNext: true
  });

  //////////

  dapper.api.use(restify.pre.sanitizePath());
  dapper.api.pre(restify.plugins.pre.dedupeSlashes());
  dapper.api.use(restify.plugins.dateParser());
  dapper.api.use(restify.plugins.queryParser());
  dapper.api.use(restify.plugins.bodyParser());
  dapper.api.use(restify.plugins.authorizationParser());
  dapper.api.use(cookieParser.parse);

  dapper.api.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', API_CORS_METHODS);
    res.header('Access-Control-Allow-Headers', API_CORS_HEADERS);

    res.header('dapper-version', dapper.version);

    return next();
  });

  //////////

  function serverStatic(directory) {
    dapper.api.get('/*', restify.plugins.serveStatic({
      directory: `./${ directory }`,
      default: 'index.html'
    }));

    dapper.api.get('/css/*', restify.plugins.serveStatic({
      directory: `./${ directory }/css`,
      appendRequestPath: false
    }));

    dapper.api.get('/fonts/*', restify.plugins.serveStatic({
      directory: `./${ directory }/fonts`,
      appendRequestPath: false
    }));

    dapper.api.get('/img/*', restify.plugins.serveStatic({
      directory: `./${ directory }/img`,
      appendRequestPath: false
    }));

    dapper.api.get('/js/*', restify.plugins.serveStatic({
      directory: `./${ directory }/js`,
      appendRequestPath: false
    }));
  }

  //////////

  dapper.api.post('/api/session', dapper.sessions.login, dapper.sessions.expand);

  dapper.api.get('/api/session', dapper.sessions.validate, dapper.sessions.expand);

  dapper.api.del('/api/session', dapper.sessions.validate, (req, res, next) => {
    dapper.sessions.clear(req.authorization.session.id);
    res.clearCookie(dapper.config.api.cookie);
    res.send(204);
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

    return dapper.api.listen(dapper.config.api.port, (error) => {
      if (error) {
        return callback(error);
      }

      console.log(`Dapper API server listening on http://0.0.0.0:${ dapper.config.api.port }`);
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
