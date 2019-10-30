'use strict';

const path = require('path');
const winston = require('winston');
const style = require('barrkeep/style');

const GREY = 'grey62';

function Logger (dapper) {
  const self = this;

  //////////

  self.serviceColor = (service) => {
    if (service === 'dapper') {
      return '#005fd7';
    } else if (service === 'api') {
      return '#5f00af';
    } else if (service === 'auth') {
      return '#5fff00';
    } else if (service === 'datastore') {
      return '#875fd7';
    } else if (service === 'ldap') {
      return '#d75f00';
    } else if (service === 'radius') {
      return '#af0000';
    } else if (service === 'sessions') {
      return '#00875f';
    }

    return GREY;
  };

  self.consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(info => {
      info.service = info.service || 'dapper';
      return style(`${ info.timestamp } [`, GREY) + style(info.service,
        self.serviceColor(info.service)) +
        style('/', GREY) + info.level + style(']: ', GREY) + info.message;
    })
  );

  //////////

  self.configure = function() {
    dapper.log.clear();

    if (dapper.config.logs.console) {
      if (typeof dapper.config.logs.console !== 'string') {
        dapper.config.logs.console = 'info';
      }

      dapper.log.add(new winston.transports.Console({
        format: self.consoleFormat,
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
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        filename: dapper.config.logs.filename,
        level: dapper.config.logs.file
      }));
    }
  };

  //////////

  dapper.log = winston.createLogger({ level: 'info' });

  // Default logger
  dapper.log.add(new winston.transports.Console({
    format: self.consoleFormat,
    level: dapper.config.logs.console
  }));

  //////////

  return self;
}

module.exports = function(dapper) {
  return new Logger(dapper);
};
