'use strict';

const async = require('async');
const assert = require('assert');
const MongoClient = require('mongodb').MongoClient;

const Dapper = require('../lib/dapper');
const dapper = new Dapper();

module.exports = function(data, options) {
  const url = process.env.DAPPER_MONGO_URL || options.url;
  const client = new MongoClient(url, { useNewUrlParser: true });

  client.connect((error) => {
    assert.equal(null, error);
    const db = client.db();

    function dropDatabase (callback) {
      if (options.drop) {
        console.log('Dropping database...');
        return db.dropDatabase(callback);
      }
      return callback();
    }

    dropDatabase(() => {
      const collections = [ {
        field: 'config',
        collection: db.collection('config'),
        model: null
      }, {
        field: 'domains',
        collection: db.collection('domains'),
        model: 'domain',
        mapping: 'domain'
      }, {
        field: 'organizations',
        collection: db.collection('organizations'),
        model: 'organization',
        mapping: 'name'
      }, {
        field: 'groups',
        collection: db.collection('groups'),
        model: 'group',
        mapping: 'name'
      }, {
        field: 'users',
        collection: db.collection('users'),
        model: 'user',
        mapping: null
      } ];

      return async.each(collections, (category, next) => {
        if (category.field === 'config') {
          if (data.config && Object.keys(data.config).length) {
            return category.collection.updateOne({ id: 'dapper-config' },
              { $set: data.config },
              { upsert: true }, () => {
                console.log('Imported configuration.');
                return next();
              });
          }
          return next();
        }

        if (Array.isArray(data[category.field]) && data[category.field].length) {
          return async.map(data[category.field], (item, done) => {
            if (category.mapping && typeof item === 'string') {
              item = { [category.mapping]: item };
            }
            const model = dapper.models[category.model](item);
            if (model.object === 'user') {
              return dapper.auth.ensureSecure(model.password, (error, hash) => {
                if (error) {
                  return done(error);
                }
                model.password = hash;
                return done(null, model);
              });
            }
            return done(null, model);
          }, (error, models) => {
            return async.each(models, (item, step) => {
              category.collection.updateOne({ id: item.id },
                { $set: item },
                { upsert: true }, step);
            }, (error) => {
              assert.equal(null, error);
              console.log(`Imported ${ models.length } ${ category.field }.`);
              return next();
            });
          });
        }
        return next();
      }, () => {
        console.log('Done.');
        client.close();
      });
    });
  });
};
