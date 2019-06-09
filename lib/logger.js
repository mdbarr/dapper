'use strict';

const path = require('path');
const winston = require('winston');

function Logger(dapper) {
  const self = this;

  dapper.log = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'dapper' }
  });

  if (dapper.config.logs.console) {
    if (typeof dapper.config.logs.console !== 'string') {
      dapper.config.logs.console = 'info';
    }

    dapper.log.add(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
      level: dapper.config.logs.console
    }));
  }

  if (dapper.config.logs.file) {
    if (typeof dapper.config.logs.file !== 'string') {
      dapper.config.logs.file = 'info';
    }
    if (!dapper.config.logs.filename) {
      dapper.config.logs.filename = path.join(process.cwd(), 'dapper.log');
    }

    dapper.log.add(new winston.transports.File({
      filename: dapper.config.logs.filename,
      level: dapper.config.logs.file
    }));
  }

  return self;
}

module.exports = function(dapper) {
  return new Logger(dapper);
};
