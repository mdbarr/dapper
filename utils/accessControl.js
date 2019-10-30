'use strict';

const CIDRMatcher = require('cidr-matcher');

function AccessControl ({
  allow = [], deny = [], order = 'deny, allow'
}) {
  if (!Array.isArray(allow)) {
    allow = [ allow ];
  }

  if (!Array.isArray(deny)) {
    deny = [ deny ];
  }

  const allowMatcher = new CIDRMatcher(allow);

  const allowed = (ip) => {
    return allowMatcher.contains(ip);
  };

  const denyMatcher = new CIDRMatcher(deny);

  const denied = (ip) => {
    return denyMatcher.contains(ip);
  };

  this.check = function(ip) {
    if (order === 'allow, deny') {
      // If the ip does not match the Allow rule or it does match
      // the Deny rule, then the client will be denied access.
      if (!allowed(ip) || denied(ip)) {
        return false;
      }
      return true;
    } else if (order === 'deny, allow') {
      // If the ip does not match the deny rule or it does match
      // the allow rule, then it will be granted access.
      if (!denied(ip) || allowed(ip)) {
        return true;
      }
      return false;
    }
    // Unrecognized ordering, deny access.
    return false;
  };
}

module.exports = AccessControl;
