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

  self.group = function() {};
  self.organization = function() {}; // mfa required
  self.organizationUnit = function() {};

  self.ldapUser = function() {};
  self.ldapGroup = function() {};
  self.ldapOrganization = function() {};
  self.ldapOrganizationUnit = function() {};

  return self;
}

module.exports = new Models();
