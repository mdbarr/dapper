'use strict';

require('barrkeep/shim');
const async = require('async');

function Dapper (config = {}) {
  const self = this;

  //////////

  self.defaults = require('./defaults');

  self.version = require('../package.json').version;
  self.config = Object.$merge(self.defaults, config, true);

  //////////

  self.util = require('./util')(self);
  self.logger = require('./logger')(self);
  self.models = require('./models')(self);
  self.auth = require('./authentication')(self);
  self.store = require('./datastore')(self);

  self.sessions = require('./sessions')(self);
  self.apiServer = require('./apiServer')(self);
  self.ldapServer = require('./ldapServer')(self);
  self.radiusServer = require('./radiusServer')(self);

  //////////

  self.tree = self.models.tree();

  //////////

  self.boot = function(callback) {
    callback = self.util.callback(callback);

    self.log.info(`Dapper v${ self.version } starting...`);
    return self.store.populate(self.tree, (error) => {
      if (error) {
        return callback(error);
      }

      self.logger.configure();

      return async.series([
        self.sessions.boot,
        self.apiServer.boot,
        self.ldapServer.boot,
        self.radiusServer.boot,
      ], (error) => {
        if (!error) {
          process.on('SIGINT', self.shutdown);
          self.log.info('Ready!');
        }

        return callback(error);
      });
    });
  };

  self.shutdown = function(callback) {
    callback = self.util.callback(callback);

    async.series([
      self.store.shutdown,
      self.sessions.shutdown,
      self.apiServer.shutdown,
      self.ldapServer.shutdown,
      self.radiusServer.shutdown,
    ], callback);
  };

  //////////

  return self;
}

module.exports = Dapper;
