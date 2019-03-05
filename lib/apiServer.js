'use strict';

const restify = require('restify');

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

  dapper.api.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS, POST, PUT');
    res.header('Access-Control-Allow-Headers', 'Access-Control-Allow-Headers, Origin, Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers, Authorization');

    res.header('dapper-server-version', dapper.version);

    next();
  });

  //////////

  self.boot = function(callback) {
    callback();
  };

  self.shutdown = function(callback) {
    callback();
  };

  //////////

  return self;
}

module.exports = function(dapper) {
  return new APIServer(dapper);
};
