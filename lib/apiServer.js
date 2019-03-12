'use strict';

const restify = require('restify');

const API_DEFAULT_PORT = 1389;

function APIServer(dapper) {
  const self = this;

  dapper.api = restify.createServer({
    name: 'Dapper',
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

  dapper.api.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS, POST, PUT');
    res.header('Access-Control-Allow-Headers', [
      'Access-Control-Allow-Headers', 'Origin', 'Accept', 'X-Requested-With',
      'Content-Type', 'Access-Control-Request-Method', 'Access-Control-Request-Headers',
      'Authorization' ].join(', '));

    res.header('dapper-server-version', dapper.version);

    return next();
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
