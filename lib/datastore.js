'use strict';

const async = require('async');
const MongoClient = require('mongodb').MongoClient;

class Store {
  constructor(dapper, tree) {
    Object.$private(this, 'dapper', dapper);
    this.tree = tree;
    this.dapper = dapper;
  }

  load(callback) {
    callback = this.dapper.util.callback(callback, true);
    callback();
  }

  shutdown(callback) {
    callback = this.dapper.util.callback(callback, true);
    callback();
  }
}

class MemoryStore extends Store {
  constructor(dapper, tree) {
    super(dapper, tree);
    console.debug('MemoryStore initializing...');
  }

  load(callback) {
    callback = this.dapper.util.callback(callback, true);
    if (this.dapper.config.datastore.data &&
        typeof this.dapper.config.datastore.data === 'object') {
      Object.$merge(this.tree, this.dapper.config.datastore.data);
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
    callback = this.dapper.util.callback(callback, true);
    const data = require(`../${ this.dapper.config.datastore.file }`);
    if (typeof data === 'function') {
      data(this.dapper, this.tree, callback);
    } else {
      Object.$merge(this.tree, data);
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
      if (error) {
        return callback(error);
      }

      self.db = self.client.db();
      self.collections = {
        config: self.db.collection('config'),
        domains: self.db.collection('domains'),
        organizations: self.db.collection('organizations'),
        groups: self.db.collection('groups'),
        users: self.db.collection('users')
      };

      return async.eachOf(self.collections, (collection, key, next) => {
        if (key === 'config') {
          return self.collections.config.findOne({ id: 'dapper-config' }, (error, config) => {
            self.tree.config = config;
            return next();
          });
        }
        return collection.find({}).toArray((error, items) => {
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

  shutdown(callback) {
    this.client.close(callback);
  }
}

//////////

function DataStore(dapper) {
  const self = this;

  dapper.models.Store = Store;

  const store = {};

  self.providers = {
    file: FileStore,
    memory: MemoryStore,
    mongo: MongoStore
  };

  self.populate = function(tree, callback) {
    let provider = null;
    if (process.env.DAPPER_MONGO_URL) {
      provider = 'mongo';
    } else {
      provider = process.env.DAPPER_DATASTORE || dapper.config.datastore.provider;
    }

    if (!self.providers[provider]) {
      return callback(new Error(`No such datastore provider: ${ provider }`));
    }

    self.Provider = self.providers[provider];
    self.provider = new self.Provider(dapper, store);

    return self.provider.load(() => {
      if (typeof store.config === 'object' && store.config) {
        dapper.config = Object.$merge(dapper.config, store.config, true);
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

      console.log('Dapper Datastore ready.');
      return callback();
    });
  };

  self.shutdown = function(callback) {
    self.provider.shutdown(callback);
  };

  return self;
}

module.exports = function(dapper) {
  return new DataStore(dapper);
};
