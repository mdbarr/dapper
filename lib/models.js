'use strict';

function Models(dapper) {
  const self = this;

  self.node = function() {};
  self.tree = function() {
    const model = {
      object: 'tree',

      users: [],
      groups: [],
      organizations: [],

      store: {}
    };

    return model;
  };

  self.user = function({
    id,
    username, password, mfa = false,
    name, email,
    organization, organizations = [],
    group, groups = [],
    permissions = {},
    attributes = {},
    metadata = {}
  }) {
    const model = {
      id: id || dapper.util.id(),
      object: 'user',

      username, // required
      password: dapper.util.ensureSecure(password), // required
      mfa: mfa || dapper.util.generateSecret(),

      name, // required
      email, // required

      organizations,
      groups,

      permissions: Object.merge({
        administrator: false,
        add: false,
        bind: true,
        del: false,
        modify: 'self',
        search: true
      }, permissions),

      attributes: Object.merge({
        accountLocked: false,
        mfaEnabled: false,
        passwordResetRequired: false
      }, attributes),

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
    id, name, options = {}, metadata = {}
  }) {
    const model = {
      id: id || dapper.util.id(),
      object: 'group',

      name,
      members: [],
      options,
      metadata
    };

    return model;
  };

  self.organization = function({
    id, name, options = {}, metadata = {}
  }) {
    const model = {
      id: id || dapper.util.id(),
      object: 'organization',

      name,
      options, // e.g., mfa required
      metadata
    };

    return model;
  };

  self.organizationalUnit = function({
    id, name, options = {}, metadata = {}
  }) {
    const model = {
      id: id || dapper.util.id(),
      object: 'organizationalUnit',

      name,
      options,
      metadata
    };

    return model;
  };

  //////////

  self.ldapUser = function(user) {
    const model = {
      object: 'ldapUser',
      objectClass: [
        'top',
        'person',
        'organizationalPerson',
        dapper.config.users.type
      ],

      dn: null,
      bind: null,

      primaryDN: null,
      cn: user.metadata.cn || user.name,
      displayName: user.metadata.displayName || user.name,

      sn: user.metadata.sn || user.name.replace(/^(\w+)\s.*$/, '$1'),
      givenName: user.metadata.givenName || user.name.replace(/^.*\s(\w+)$/, '$1'),

      userPassword: user.password,
      mfa: user.mfa,

      uid: user.metadata.uid || user.username,
      email: user.metadata.email || user.email,

      o: user.organizations,
      ou: dapper.config.users.ou,
      memberOf: user.groups
    };

    //////////
    // generate DNs

    const dn = new Set();
    const bind = new Set();

    // uuid - special case
    dn.add(`uuid=${ user.id }, o=uuids`);
    bind.add('o=uuids');

    const dcs = dapper.util.Set(dapper.config.options.dc);
    if (dapper.config.options.parseEmailToDC) {
      dcs.add('dc=' + model.email.replace(/^.*@/, '').split('.').join(', dc='));
    }
    const orgs = dapper.util.Set(model.o);

    for (const dc of dcs) {
      for (let o of orgs) {
        o = (o) ? 'o=' + o : o;
        const ou = 'ou=' + model.ou;

        for (const key of dapper.config.users.keys) {
          const value = `${ key }=${ model[key] }`;

          if (key === dapper.config.users.primaryKey) {
            model.primaryDN = dapper.util.toDN([ value, ou, o, dc ], dn, bind);
          } else {
            dapper.util.toDN([ value, ou, o, dc ], dn, bind);
          }
        }

        for (const multikey in dapper.config.users.multikeys) {
          for (const mapping of dapper.config.users.multikeys[multikey]) {
            const multivalue = `${ multikey }=${ model[mapping] }`;
            dapper.util.toDN([ multivalue, ou, o, dc ], dn, bind);
          }
        }
      }
    }

    model.dn = Array.from(dn).sort();
    model.bind = Array.from(bind).sort();

    return model;
  };

  self.ldapGroup = function(group) {
    const model = {
      object: 'ldapGroup',
      objectClass: [
        'top',
        'group',
        dapper.config.groups.type
      ],

      dn: [ `id: ${ group.id }` ],

      group: group.metadata.name || group.name,
      member: group.members
    };

    // generate DNs

    return model;
  };

  self.ldapOrganization = function() {};
  self.ldapOrganizationalUnit = function() {};

  return self;
}

module.exports = function(dapper) {
  return new Models(dapper);
};
