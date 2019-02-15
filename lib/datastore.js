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
    super.load(callback);
  }
}

class FileStore extends Store {
  constructor(dapper, tree) {
    super(dapper, tree);
  }

  load(callback) {
    super.load(callback);
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
    if (dapper.config.datastore === 'memory') {
      self.store = new MemoryStore(dapper, tree);
    } else if (dapper.config.datastore === 'file') {
      self.store = new FileStore(dapper, tree);
    } else if (dapper.config.datastore === 'mongo') {
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
