'use strict';

const uuid = require('uuid/v4');
const crypto = require('crypto');

function Util(dapper) {
  const self = this;

  self.id = () => uuid();

  self.timestamp = () => Date.now();

  self.sha256 = function(input) {
    if (typeof input !== 'string') {
      input = JSON.stringify(input);
    }
    return crypto.createHash('sha256').update(input).digest('hex');
  };

  self.Set = function(value) {
    if (!Array.isArray(value)) {
      value = [ value ];
    }

    const set = new Set(value);
    if (dapper.config.options.allowEmpty) {
      set.add('');
    }

    return set;
  };

  self.toDN = function(values, dnSet, bindSet) {
    values = values.filter((value) => !!value);
    const bindValues = values.slice().shift();

    const dn = values.join(', ');
    const bind = bindValues.join(', ');

    if (dn) {
      dnSet.add(dn);
    }

    if (bind) {
      bindSet.add(bind);
    }
  };

  return self;
}

module.exports = function(dapper) {
  return new Util(dapper);
};
