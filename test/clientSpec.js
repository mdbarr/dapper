'use strict';

require('should');
require('barrkeep');

const Dapper = require('../lib/dapper');

describe('Client Spec', function() {
  let dapper;
  let config;

  describe('Instance creation test', function() {
    it('should load Sample Data A into memory', function() {
      config = require('./sampleDataA');
    });

    it('should create a new Dapper instance', function() {
      dapper = new Dapper(config);
      dapper.should.be.ok();
    });

    it('should boot the dapper instance', function(done) {
      dapper.boot(done);
    });
  });

  describe('Clean up', function() {
    it('should stop the dapper instance', function() {
      dapper.shutdown();
    });
  });
});
