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
        domains: {},
        organizations: {},
        groups: {},
        users: {},
        index: {}
      },
      ldap: {
        domains: {},
        organizations: {},
        groups: {},
        users: {},
        index: {},
        binds: new Map(),
        dns: new Map()
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

      domain: domain.trim(),
      options,
      metadata
    };

    tree.models.domains[model.domain] = model;
    tree.models.index[model.id] = model;

    return model;
  };

  self.organization = function({
    id, name, options = {}, metadata = {}
  }, tree = dapper.tree) {
    const model = {
      id: id || dapper.util.id(),
      object: 'organization',

      name: name.trim(),
      options,
      metadata
    };

    tree.models.organizations[model.name] = model;
    tree.models.index[model.id] = model;

    return model;
  };

  self.group = function({
    id, name, organization, options = {}, metadata = {}
  }, tree = dapper.tree) {
    const model = {
      id: id || dapper.util.id(),
      object: 'group',

      name: name.trim(),
      organization: organization.trim(),
      options,
      metadata
    };

    tree.models.groups[model.name] = model;
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

    tree.models.users[model.username] = model;
    tree.models.index[model.id] = model;

    return model;
  };

  //////////
  // LDAP representations
  self.ldap = {};

  self.ldap.domain = function(domain, tree = dapper.tree) {
    const model = {
      id: domain.id,
      object: 'ldapDomain',

      dn: 'dc=' + domain.domain.toLowerCase().split('.').join(', dc='),
      attributes: {
        dc: domain.domain,
        objectclass: [
          'top',
          'dcObject'
        ]
      }
    };

    Object.private(model, 'model', domain);
    Object.private(domain, 'ldap', model);

    tree.ldap.domains[model.dn] = model;
    tree.ldap.index[model.id] = model;

    tree.ldap.dns.set(model.dn, model);

    return model;
  };

  self.ldap.organization = function(organization, tree = dapper.tree) {
    const model = {
      id: organization.id,
      object: 'ldapOrganization',

      dn: `o=${ organization.name.toLowerCase() }`,
      attributes: {
        o: organization.name,
        objectclass: [
          'top',
          'organization'
        ]
      }
    };

    Object.private(model, 'model', organization);
    Object.private(organization, 'ldap', model);

    tree.ldap.organizations[model.dn] = model;
    tree.ldap.index[model.id] = model;

    tree.ldap.dns.set(model.dn, model);

    return model;
  };

  self.ldap.group = function(group, tree = dapper.tree) {
    const model = {
      id: group.id,
      object: 'ldapGroup',

      dn: `cn=${ group.name.toLowerCase() }, ou=${ dapper.config.groups.ou.toLowerCase() }`,
      attributes: {
        group: group.metadata.name || group.name,
        member: group.members,
        o: group.organization,
        objectclass: [
          'top',
          'group',
          dapper.config.groups.type
        ]
      }
    };

    if (group.organization) {
      model.dn += `, o=${ group.organization.toLowerCase() }`;
    }

    Object.private(model, 'model', group);
    Object.private(group, 'ldap', model);

    tree.ldap.groups[model.dn] = model;
    tree.ldap.index[model.id] = model;

    tree.ldap.dns.set(model.dn, model);

    return model;
  };

  self.ldap.user = function(user, tree = dapper.tree) {
    const model = {
      object: 'ldapUser',

      dns: null,
      binds: null,

      dn: null,
      attributes: {
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
        memberOf: [ ],
        objectclass: [
          'top',
          'person',
          'organizationalPerson',
          dapper.config.users.type
        ]
      }
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
      dcs.add('dc=' + model.attributes.email.replace(/^.*@/, '').split('.').join(', dc='));
    }
    const orgs = dapper.util.Set(model.attributes.o);

    for (const dc of dcs) {
      for (let o of orgs) {
        o = (o) ? 'o=' + o : o;
        const ou = 'ou=' + model.attributes.ou;

        for (const key of dapper.config.users.keys) {
          const value = `${ key }=${ model.attributes[key] }`;

          if (key === dapper.config.users.primaryKey) {
            model.dn = dapper.util.toDN([ value, ou, o, dc ], dn, bind);
          } else {
            dapper.util.toDN([ value, ou, o, dc ], dn, bind);
          }
        }

        for (const multikey in dapper.config.users.multikeys) {
          for (const mapping of dapper.config.users.multikeys[multikey]) {
            const multivalue = `${ multikey }=${ model.attributes[mapping] }`;
            dapper.util.toDN([ multivalue, ou, o, dc ], dn, bind);
          }
        }
      }
    }

    for (let group of user.groups) {
      if (tree.models.groups[group]) {
        group = tree.models.groups[group].ldap;
        model.attributes.memberOf.push(group.dn);
      }
    }

    model.dns = Array.from(dn).sort();
    model.binds = Array.from(bind).sort();

    Object.private(model, 'model', user);
    Object.private(user, 'ldap', model);

    tree.ldap.users[model.dn] = model;
    tree.ldap.index[model.id] = model;

    tree.ldap.dns.set(model.dn, model);

    return model;
  };

  //////////

  return self;
}

module.exports = function(dapper) {
  return new Models(dapper);
};
