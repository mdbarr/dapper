#!/usr/bin/env node

'use strict';

const Dapper = require('./lib/dapper');

const dapper = new Dapper();
dapper.boot();
