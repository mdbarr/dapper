'use strict';

function Models(dapper) {
  const self = this;

  //////////
  // Model representations

  self.tree = function() {
    const model = {
      id: 'tree',
      object: 'tree',

      models: {
        domains: [],
        organizations: [],
        groups: [],
        users: [],
        index: {}
      },
      ldap: {
        domains: [],
        organizations: [],
        groups: [],
        users: [],
        index: {},
        dn: {}
      }
    };

    return model;
  };

  self.domain = function({
    id, domain, options = {}, metadata = {}
  }, tree = dapper.tree) {
    const model = {
      id: id || dapper.util.id(),
      object: 'domain',

      domain,
      options,
      metadata
    };

    tree.models.domains.push(model);
    tree.models.index[model.id] = model;

    return model;
  };

  self.organization = function({
    id, name, options = {}, metadata = {}
  }, tree = dapper.tree) {
    const model = {
      id: id || dapper.util.id(),
      object: 'organization',

      name,
      options,
      metadata
    };

    tree.models.organizations.push(model);
    tree.models.index[model.id] = model;

    return model;
  };

  self.group = function({
    id, name, organization, options = {}, metadata = {}
  }, tree = dapper.tree) {
    const model = {
      id: id || dapper.util.id(),
      object: 'group',

      name,
      organization,
      options,
      metadata
    };

    tree.models.group.push(model);
    tree.models.index[model.id] = model;

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
  }, tree = dapper.tree) {
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

    tree.models.users.push(model);
    tree.models.index[model.id] = model;

    return model;
  };

  //////////
  // LDAP representations

  self.ldapDomain = function(domain, tree = dapper.tree) {
    const model = {
      id: domain.id,
      object: 'ldapDomain',
      objectClass: [
        'top',
        'dcObject'
      ],

      dn: 'dc=' + domain.domain.split('.').join(', dc='),
      dc: domain.domain
    };

    Object.private(model, 'model', domain);

    tree.ldap.domains.push(model);
    tree.ldap.index[model.id] = model;
    tree.ldap.dn[model.dn] = model;

    return model;
  };

  self.ldapOrganization = function(organization, tree = dapper.tree) {
    const model = {
      id: organization.id,
      object: 'ldapOrganization',
      objectClass: [
        'top',
        'organization'
      ],

      dn: `o=${ organization.name }`,
      o: organization.name
    };

    Object.private(model, 'model', organization);

    tree.ldap.organizations.push(model);
    tree.ldap.index[model.id] = model;
    tree.ldap.dn[model.dn] = model;

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

  //////////

  return self;
}

module.exports = function(dapper) {
  return new Models(dapper);
};
