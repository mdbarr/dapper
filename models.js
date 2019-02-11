'use strict';

function Models() {
  const self = this;

  self.node = function() {};
  self.tree = function() {};

  self.user = function({
    name, email,
    username, password, mfa = false,
    organization, organizations = [],
    group, groups = [],
    metadata = {}
  }) {
    const model = {
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
    name, members = [], options = {}, metadata = {}
  }) {
    const model = {
      name,
      members,
      options,
      metadata
    };

    return model;
  };

  self.organization = function({
    name, items = [], options = {}, metadata = {}
  }) {
    const model = {
      name,
      items,
      options, // e.g., mfa required
      metadata
    };

    return model;
  };

  self.organizationalUnit = function({
    name, items = [], options = {}, metadata = {}
  }) {
    const model = {
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

      dn: [],

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

    return model;
  };
  self.ldapGroup = function() {};
  self.ldapOrganization = function() {};
  self.ldapOrganizationalUnit = function() {};

  return self;
}

module.exports = new Models();
