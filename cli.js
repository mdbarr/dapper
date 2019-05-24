#!/usr/bin/env node

'use strict';
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const Dapper = require('./lib/dapper');

const DEFAULT_CONFIG = '/etc/dapper.config.js';

const options = minimist(process.argv.slice(2));

//////////
// Configuration

let config = {};

try {
  if (options.config) {
    const configFile = path.resolve(__dirname, options.config);
    config = require(configFile);
  } else if (fs.existsSync(DEFAULT_CONFIG)) {
    config = require(DEFAULT_CONFIG);
  }
} catch (error) {
  console.log('Error loading config file:', error.message);
}

//////////

const dapper = new Dapper(config);
dapper.boot();
