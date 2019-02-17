'use strict';

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
    if (this.dapper.config.datastore.tree &&
        typeof this.dapper.config.datastore.tree === 'object') {
      Object.merge(this.dapper.tree, this.dapper.config.datastore.tree);
    }
    super.load(callback);
  }
}

class FileStore extends Store {
  constructor(dapper, tree) {
    super(dapper, tree);
    console.debug('FileStore initializing...');
  }

  load(callback) {
    callback = this.dapper.util.callback(callback);
    const data = require('../' + this.dapper.config.datastore.file);
    if (typeof data === 'function') {
      data(this.dapper, this.tree, callback);
    } else {
      Object.merge(this.tree, data);
      callback();
    }
  }
}

class MongoStore extends Store {
  constructor(dapper, tree) {
    super(dapper, tree);
    console.debug('MongoStore initializing...');
  }

  load(callback) {
    super.load(callback);
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

  self.populate = function(tree, callback) {
    if (!self.providers[dapper.config.datastore.provider]) {
      return callback(new Error('No such datastore provider: ' + dapper.config.datastore.provider));
    }

    self.store = new self.providers[dapper.config.datastore.provider](dapper, tree);

    self.store.load(function() {
      // Create initial models
      for (let organization in store.organizations) {
        organization = dapper.models.organization(organization);
        dapper.tree.store[organization.id] = organization;
        dapper.tree.organizations.push(organization);
      }

      for (let group in store.groups) {
        group = dapper.models.group(group);
        dapper.tree.store[group.id] = group;
        dapper.tree.groups.push(group);
      }

      for (let user in store.users) {
        user = dapper.models.user(user);
        dapper.tree.store[user.id] = user;
        dapper.tree.users.push(user);
      }

      // Create LDAP representations

      callback();
    });
  };
  return self;
};

module.exports = function(dapper) {
  return new DataStore(dapper);
};
