#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const Dapper = require('../lib/dapper');
const importer = require('../utils/import');

const DEFAULT_CONFIG = '/etc/dapper.config.js';

const options = minimist(process.argv.slice(2));

//////////
// Configuration

let config = {};

try {
  if (options.config) {
    const configFile = path.resolve(process.cwd(), options.config);
    config = require(configFile);
  } else if (fs.existsSync(DEFAULT_CONFIG)) {
    config = require(DEFAULT_CONFIG);
  }
} catch (error) {
  console.log('Error loading config file:', error.message);
}

if (process.env.DAPPER_MONGO_URL || options.url) {
  config.datastore = config.datastore || {};
  config.datastore.provider = 'mongo';
  config.datastore.url = process.env.DAPPER_MONGO_URL || options.url;
} else if (process.env.DAPPER_DATASTORE || options.datastore) {
  config.datastore = config.datastore || {};
  config.datastore.provider = process.env.DAPPER_DATASTORE || options.datastore;
}

//////////

if (options.import) {
  const dataFile = path.resolve(process.cwd(), options.import);
  const data = require(dataFile);

  importer(data, options, config);
} else {
  const dapper = new Dapper(config);
  dapper.boot((error) => {
    if (error) {
      console.log('Error booting Dapper:', error.message);
      process.exit(1);
    }
    console.log('Dapper server ready!');
  });
}
