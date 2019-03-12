'use strict';

const async = require('async');
const assert = require('assert');
const MongoClient = require('mongodb').MongoClient;

class Store {
  constructor(dapper, tree) {
    Object.private(this, 'dapper', dapper);
    this.tree = tree;
  }

  load(callback) {
    callback = this.dapper.util.callback(callback);
    callback();
  }
}

class MemoryStore extends Store {
  constructor(dapper, tree) {
    super(dapper, tree);
    console.debug('MemoryStore initializing...');
  }

  load(callback) {
    callback = this.dapper.util.callback(callback);
    if (this.dapper.config.datastore.data &&
        typeof this.dapper.config.datastore.data === 'object') {
      Object.merge(this.tree, this.dapper.config.datastore.data);
    }
    callback();
  }
}

class FileStore extends Store {
  constructor(dapper, tree) {
    super(dapper, tree);
    console.debug('FileStore initializing...');
  }

  load(callback) {
    callback = this.dapper.util.callback(callback);
    const data = require(`../${ this.dapper.config.datastore.file }`);
    if (typeof data === 'function') {
      data(this.dapper, this.tree, callback);
    } else {
      Object.merge(this.tree, data);
    }
    callback();
  }
}

class MongoStore extends Store {
  constructor(dapper, tree) {
    super(dapper, tree);
    console.debug('MongoStore initializing...');
    this.url = process.env.DAPPER_MONGO_URL || dapper.config.datastore.url;
    this.client = new MongoClient(this.url, { useNewUrlParser: true });
  }

  load(callback) {
    const self = this;
    self.client.connect((error) => {
      assert.equal(null, error);
      self.db = self.client.db();
      self.collections = {
        config: self.db.collection('config'),
        domains: self.db.collection('domains'),
        organizations: self.db.collection('organizations'),
        groups: self.db.collection('groups'),
        users: self.db.collection('users')
      };

      async.eachOf(self.collections, (collection, key, next) => {
        collection.find({}).toArray((error, items) => {
          if (error) {
            return next(error);
          }
          self.tree[key] = items;
          return next();
        });
      }, (error) => {
        return callback(error);
      });
    });
  }
}

//////////

function DataStore(dapper) {
  const self = this;

  const store = {};

  self.providers = {
    file: FileStore,
    memory: MemoryStore,
    mongo: MongoStore
  };

  let provider = null;

  self.populate = function(tree, callback) {
    provider = process.env.DAPPER_DATASTORE || dapper.config.datastore.provider;

    if (!self.providers[provider]) {
      return callback(new Error(`No such datastore provider: ${ provider }`));
    }

    self.store = new self.providers[provider](dapper, store);

    return self.store.load(() => {
      if (typeof store.config === 'object' && store.config) {
        dapper.config = Object.merge(dapper.config, store.config, true);
      }

      if (Array.isArray(store.domains)) {
        for (let domain of store.domains) {
          if (typeof domain === 'string') {
            domain = { domain };
          }
          const model = dapper.models.domain(domain);
          dapper.models.ldap.domain(model);
        }
      }

      if (Array.isArray(store.organizations)) {
        for (let org of store.organizations) {
          if (typeof org === 'string') {
            org = { name: org };
          }
          const model = dapper.models.organization(org);
          dapper.models.ldap.organization(model);
        }
      }

      if (Array.isArray(store.groups)) {
        for (let group of store.groups) {
          if (typeof group === 'string') {
            group = { name: group };
          }
          const model = dapper.models.group(group);
          dapper.models.ldap.group(model);
        }
      }

      if (Array.isArray(store.users)) {
        for (const user of store.users) {
          const model = dapper.models.user(user);
          dapper.models.ldap.user(model);
        }
      }

      return callback();
    });
  };
  return self;
}

module.exports = function(dapper) {
  return new DataStore(dapper);
};
