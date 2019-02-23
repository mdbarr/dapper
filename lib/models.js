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
    id, name, organization = '', options = {}, metadata = {}
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

    tree.ldap.binds.set(model.dn, model);
    tree.ldap.dns.set(model.dn, model);

    return model;
  };

  self.ldap.organization = function(organization, tree = dapper.tree) {
    const model = {
      id: organization.id,
      object: 'ldapOrganization',

      dns: null,
      binds: null,

      dn: null,
      attributes: {
        o: organization.name,
        objectclass: [
          'top',
          'organization'
        ]
      }
    };

    const org = `o=${ organization.name.toLowerCase() }`;

    const dns = new Set();
    const binds = new Set();

    model.dn = dapper.util.toDN([ org ], dns, binds);

    for (const dc in tree.ldap.domains) {
      model.dn = dapper.util.preferredDN(model.dn, dapper.util.toDN([ org, dc ], dns, binds));
    }

    model.dns = Array.from(dns).sort();
    model.binds = Array.from(binds).sort();

    Object.private(model, 'model', organization);
    Object.private(organization, 'ldap', model);

    tree.ldap.organizations[model.dn] = model;
    tree.ldap.index[model.id] = model;

    model.dns.forEach(dn => tree.ldap.dns.set(dn, model));
    model.binds.forEach(bind => tree.ldap.binds.set(bind, model));

    return model;
  };

  self.ldap.group = function(group, tree = dapper.tree) {
    const model = {
      id: group.id,
      object: 'ldapGroup',

      dns: null,
      binds: null,

      dn: null,
      attributes: {
        group: group.metadata.name || group.name,
        member: [ ],
        o: group.organization,
        objectclass: [
          'top',
          'group',
          dapper.config.groups.type
        ]
      }
    };

    const dns = new Set();
    const binds = new Set();

    const baseDN = dapper.util.toDN([ `cn=${ group.name }`, `ou=${ dapper.config.groups.ou }` ], dns, binds);

    model.dn = baseDN;

    if (group.organization) {
      let organization;
      if (tree.models.organizations[group.organization]) {
        organization = tree.models.organizations[group.organization].ldap;
      } else {
        organization = self.organization({
          name: group.organization
        });
        organization = self.ldap.organization(organization);
      }

      organization.dns.forEach(function(orgDN) {
        model.dn = dapper.util.preferredDN(model.dn, dapper.util.toDN([ baseDN, orgDN ], dns, binds));
      });
    } else {
      for (let domain in tree.ldap.domains) {
        domain = tree.ldap.domains[domain];
        model.dn = dapper.util.preferredDN(model.dn, dapper.util.toDN([ baseDN, domain.dn ], dns, binds));
      }
    }

    model.dns = Array.from(dns).sort();
    model.binds = Array.from(binds).sort();

    Object.private(model, 'model', group);
    Object.private(group, 'ldap', model);

    tree.ldap.groups[model.dn] = model;
    tree.ldap.index[model.id] = model;

    model.dns.forEach(dn => tree.ldap.dns.set(dn, model));
    model.binds.forEach(bind => tree.ldap.binds.set(bind, model));

    return model;
  };

  self.ldap.user = function(user, tree = dapper.tree) {
    const model = {
      id: user.id,
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

    const dns = new Set();
    const binds = new Set();

    // uuid - special case
    dns.add(`uuid=${ user.id }, o=uuids`);
    binds.add('o=uuids');

    const dcs = dapper.util.Set(Object.keys(tree.ldap.domains));
    if (dapper.config.options.parseEmailToDC) {
      dcs.add('dc=' + model.attributes.email.replace(/^.*@/, '').split('.').join(', dc='));
    }
    const orgs = dapper.util.Set(model.attributes.o);

    for (const dc of dcs) {
      for (let o of orgs) {

        if (o) {
          if (!tree.models.organizations[o]) {
            let organization = self.organization({
              name: o
            });
            organization = self.ldap.organization(organization);
          }
          o = 'o=' + o;
        }

        const ou = 'ou=' + model.attributes.ou;

        for (const key of dapper.config.users.keys) {
          const value = `${ key }=${ model.attributes[key] }`;

          if (key === dapper.config.users.primaryKey) {
            model.dn = dapper.util.preferredDN(model.dn, dapper.util.toDN([ value, ou, o, dc ], dns, binds));
          } else {
            dapper.util.toDN([ value, ou, o, dc ], dns, binds);
          }
        }

        for (const multikey in dapper.config.users.multikeys) {
          for (const mapping of dapper.config.users.multikeys[multikey]) {
            const multivalue = `${ multikey }=${ model.attributes[mapping] }`;
            dapper.util.toDN([ multivalue, ou, o, dc ], dns, binds);
          }
        }
      }
    }

    for (let group of user.groups) {
      if (tree.models.groups[group]) {
        group = tree.models.groups[group].ldap;
        model.attributes.memberOf.push(group.dn);
        group.attributes.member.push(model.dn);
      } else {
        group = self.group({
          name: group
        });
        group = self.ldap.group(group);
        model.attributes.memberOf.push(group.dn);
        group.attributes.member.push(model.dn);
      }
    }

    model.dns = Array.from(dns).sort();
    model.binds = Array.from(binds).sort();

    Object.private(model, 'model', user);
    Object.private(user, 'ldap', model);

    tree.ldap.users[model.dn] = model;
    tree.ldap.index[model.id] = model;

    model.dns.forEach(dn => tree.ldap.dns.set(dn, model));
    model.binds.forEach(bind => tree.ldap.binds.set(bind, model));

    return model;
  };

  //////////

  return self;
}

module.exports = function(dapper) {
  return new Models(dapper);
};
