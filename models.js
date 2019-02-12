'use strict';

function Models(dapper) {
  const self = this;

  self.node = function() {};
  self.tree = function() {};

  self.user = function({
    id, name, email,
    username, password, mfa = false,
    organization, organizations = [],
    group, groups = [],
    metadata = {}
  }) {
    const model = {
      id: id || dapper.util.id(),
      object: 'user',

      name,
      email,

      username,
      password,
      mfa,

      organizations,
      groups,

      metadata
    };

    if (organization) {
      model.organizations.push(organization);
    }

    if (group) {
      model.groups.push(group);
    }

    return model;
  };

  self.group = function({
    id, name, members = [], options = {}, metadata = {}
  }) {
    const model = {
      id: id || dapper.util.id(),
      object: 'group',

      name,
      members,
      options,
      metadata
    };

    return model;
  };

  self.organization = function({
    id, name, items = [], options = {}, metadata = {}
  }) {
    const model = {
      id: id || dapper.util.id(),
      object: 'organization',

      name,
      items,
      options, // e.g., mfa required
      metadata
    };

    return model;
  };

  self.organizationalUnit = function({
    id, name, items = [], options = {}, metadata = {}
  }) {
    const model = {
      id: id || dapper.util.id(),
      object: 'organizationalUnit',

      name,
      items,
      options,
      metadata
    };

    return model;
  };

  self.ldapUser = function(user) {
    const model = {
      object: 'ldapUser',
      objectClass: [
        'top',
        'person',
        'organizationalPerson',
        'inetOrgPerson'
      ],

      dn: [ `id: ${ user.id }` ],

      cn: user.metadata.cn || user.name,
      displayName: user.metadata.displayName || user.name,

      sn: user.metadata.sn || user.name.replace(/^(\w+)\s.*$/, '$1'),
      givenName: user.metadata.givenName || user.name.replace(/^.*\s(\w+)$/, '$1'),

      userPassword: user.password,

      uid: user.metadata.uid || user.username,
      mail: user.metadata.mail || user.email,

      o: user.organizations,
      ou: 'Users',
      memberOf: user.groups
    };

    // generate DNs

    return model;
  };
  self.ldapGroup = function() {};
  self.ldapOrganization = function() {};
  self.ldapOrganizationalUnit = function() {};

  return self;
}

module.exports = function(dapper) {
  new Models(dapper);
};
