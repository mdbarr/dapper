'use strict';

const uuid = require('uuid/v4');
const crypto = require('crypto');

function Util() {
  const self = this;

  self.id = () => uuid();

  self.timestamp = () => Date.now();

  self.sha256 = function(input) {
    if (typeof input !== 'string') {
      input = JSON.stringify(input);
    }
    return crypto.createHash('sha256').update(input).digest('hex');
  };

  return self;
}

module.exports = function(dapper) {
  return new Util(dapper);
};
