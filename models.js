'use strict';

function Models() {
  const self = this;

  self.user = function({
    name, email, username, password,
    organization, organizations = [],
    group, groups = [],
    metadata = {}
  }) {
    const model = {
      name,
      email,

      username,
      password,

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

  return self;
}

module.exports = new Models();
