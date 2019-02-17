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
  }

  load(callback) {
    super.load(callback);
  }
}

//////////

function DataStore(dapper) {
  const self = this;

  self.populate = function(tree, callback) {
    if (dapper.config.datastore.type === 'memory') {
      self.store = new MemoryStore(dapper, tree);
    } else if (dapper.config.datastore.type === 'file') {
      self.store = new FileStore(dapper, tree);
    } else if (dapper.config.datastore.type === 'mongo') {
      self.store = new MongoStore(dapper, tree);
    }

    self.store.load(function() {
      callback();
    });
  };
  return self;
};

module.exports = function(dapper) {
  return new DataStore(dapper);
};
