#!/usr/bin/env node

'use strict';
const path = require('path');
const minimist = require('minimist');
const Dapper = require('./lib/dapper');

const options = minimist(process.argv.slice(2));

let config = {};
if (options.config) {
  const configFile = path.resolve(__dirname, options.config);
  config = require(configFile);
}

const dapper = new Dapper(config);
dapper.boot();
