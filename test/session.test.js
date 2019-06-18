'use strict';

const should = require('should');
const request = require('request');
const Dapper = require('../lib/dapper');

describe('Session Spec', () => {
  let dapper;
  let config;

  describe('Instance Creation', () => {
    it('should load the api configuration into memory', () => {
      config = require('./configs/apiConfig.js');
    });

    it('should create a new Dapper instance', () => {
      dapper = new Dapper(config);
      dapper.should.be.ok();
    });

    it('should boot the dapper instance', (done) => {
      dapper.boot(done);
    });
  });

  describe('Session Tests', () => {
    let url;
    let jar;
    let session;

    it('should login and validate the session', (done) => {
      url = `http://127.0.0.1:${ dapper.config.api.port }/api/session`;
      jar = request.jar();

      request.post({
        url,
        jar,
        json: true,
        body: {
          username: 'foo',
          password: 'password'
        }
      }, (error, response, body) => {
        should(error).be.null();
        should(body).have.property('id');
        should(body).have.property('user');
        should(body.user).have.property('username', 'foo');

        session = body.id;

        done();
      });
    });

    it('should retrieve and validate the active session', (done) => {
      request.get({
        url,
        jar,
        json: true
      }, (error, response, body) => {
        should(error).be.null();
        should(body).have.property('user');
        should(body.user).have.property('username', 'foo');

        done();
      });
    });

    it('should access a protected endpoint', (done) => {
      request.get({
        url: url.replace('session', 'datastore'),
        jar,
        json: true
      }, (error, response, body) => {
        should(error).be.null();
        should(response.statusCode).be.equal(200);

        should(body).have.property('datastore', 'MemoryStore');

        done();
      });
    });

    it('should login again and validate the session is the same', (done) => {
      request.post({
        url,
        jar,
        json: true,
        body: {
          username: 'foo',
          password: 'password'
        }
      }, (error, response, body) => {
        should(error).be.null();
        should(body).have.property('id', session);
        should(body).have.property('user');
        should(body.user).have.property('username', 'foo');

        done();
      });
    });

    it('should successfully logout', (done) => {
      request.del({
        url,
        jar,
        json: true
      }, (error, response) => {
        should(error).be.null();
        should(response.statusCode).be.equal(204);

        done();
      });
    });

    it('should fail to get an active session', (done) => {
      request.get({
        url,
        jar,
        json: true
      }, (error, response) => {
        should(error).be.null();
        should(response.statusCode).be.equal(401);

        done();
      });
    });

    it('should fail to login with bad credentials', (done) => {
      request.post({
        url,
        jar,
        json: true,
        body: {
          username: 'foo',
          password: 'secret'
        }
      }, (error, response) => {
        should(error).be.null();
        should(response.statusCode).be.equal(401);

        done();
      });
    });
  });

  describe('Clean up', () => {
    it('should stop the dapper instance', (done) => {
      dapper.shutdown(done);
    });
  });
});
