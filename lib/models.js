'use strict';

const path = require('path');

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
        emails: {},
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

    model.rebuild = () => {
      dapper.store.rebuild();
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

    for (const property in dapper.config.metadata.domains.defaults) {
      if (!model.metadata[property]) {
        model.metadata[property] = dapper.config.metadata.domains.defaults[property];
      }
    }

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

    for (const property in dapper.config.metadata.organizations.defaults) {
      if (!model.metadata[property]) {
        model.metadata[property] = dapper.config.metadata.organizations.defaults[property];
      }
    }

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
      organization: organization.trim() || null,
      options,
      metadata
    };

    for (const property in dapper.config.metadata.groups.defaults) {
      if (!model.metadata[property]) {
        model.metadata[property] = dapper.config.metadata.groups.defaults[property];
      }
    }

    tree.models.groups[model.name] = model;
    tree.models.index[model.id] = model;

    return model;
  };

  self.user = function({
    id,
    username, password, mfa,
    name, email,
    organization, organizations = [],
    group, groups = [],
    permissions = {},
    attributes = {},
    metadata = {},
    deleted = false
  }, tree = dapper.tree) {
    const model = {
      id: id || dapper.util.id(),
      object: 'user',

      username, // required
      password: password || false,
      mfa: mfa || false,

      name, // required
      email, // required

      organizations,
      groups,

      permissions: Object.$merge({
        administrator: false,
        add: false,
        bind: true,
        del: false,
        modify: 'self',
        radius: true,
        search: true,
        session: true
      }, permissions),

      attributes: Object.$merge({
        accountLocked: false,
        mfaEnabled: false,
        passwordResetRequired: false
      }, attributes),

      metadata,
      deleted
    };

    for (const property in dapper.config.metadata.users.defaults) {
      if (!model.metadata[property]) {
        model.metadata[property] = dapper.config.metadata.users.defaults[property];
      }
    }

    if (organization) {
      model.organizations.push(organization);
    }

    if (group) {
      model.groups.push(group);
    }

    tree.models.users[model.username] = model;
    tree.models.index[model.id] = model;

    model.email = model.email.toLowerCase().trim();
    tree.models.emails[model.email] = model;

    return model;
  };

  //////////
  // LDAP representations
  self.ldap = {};

  self.ldap.domain = function(domain, tree = dapper.tree) {
    const model = {
      id: domain.id,
      object: 'ldapDomain',

      dn: `dc=${ domain.domain.split('.').join(', dc=') }`,
      attributes: {
        dc: domain.domain,
        objectclass: [
          'top',
          'dcObject'
        ]
      }
    };

    for (const property of dapper.config.metadata.domains.publish) {
      if (domain.metadata[property]) {
        model.attributes[property] = domain.metadata[property];
      }
    }

    Object.$private(model, 'model', domain);
    Object.$private(domain, 'ldap', model);

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

    for (const property of dapper.config.metadata.organizations.publish) {
      if (organization.metadata[property]) {
        model.attributes[property] = organization.metadata[property];
      }
    }

    const org = `o=${ organization.name }`;

    const dns = new Set();
    const binds = new Set();

    model.dn = dapper.util.toDN([ org ], dns, binds);

    for (const dc in tree.ldap.domains) {
      model.dn = dapper.util.preferredDN(model.dn, dapper.util.toDN([ org, dc ], dns, binds));
    }

    model.dns = Array.from(dns).sort();
    model.binds = Array.from(binds).sort();

    Object.$private(model, 'model', organization);
    Object.$private(organization, 'ldap', model);

    tree.ldap.organizations[model.dn] = model;
    tree.ldap.index[model.id] = model;

    model.dns.forEach(dn => {
      return tree.ldap.dns.set(dn, model);
    });
    model.binds.forEach(bind => {
      return tree.ldap.binds.set(bind, model);
    });

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
        cn: group.metadata.name || group.name,
        group: group.metadata.name || group.name,
        member: [ ],
        memberuid: [ ],
        o: [ ],
        objectclass: [
          'top',
          'group',
          dapper.config.groups.type
        ]
      }
    };

    if (group.organization) {
      model.attributes.o.push(group.organization);
    } else {
      for (const organization in tree.models.organizations) {
        model.attributes.o.push(organization);
      }
    }

    for (const property of dapper.config.metadata.groups.publish) {
      if (group.metadata[property]) {
        model.attributes[property] = group.metadata[property];
      }
    }

    const dns = new Set();
    const binds = new Set();

    const cn = `cn=${ group.name }`;
    const ou = `ou=${ dapper.config.groups.ou }`;

    const baseDN = dapper.util.toDN([ cn, ou ], dns, binds);

    model.dn = baseDN;

    if (model.attributes.o.length) {
      for (let organization of model.attributes.o) {
        if (tree.models.organizations[organization]) {
          organization = tree.models.organizations[organization].ldap;
        } else {
          organization = self.organization({ name: organization });
          organization = self.ldap.organization(organization);
        }

        organization.dns.forEach((orgDN) => {
          model.dn = dapper.util.preferredDN(model.dn, dapper.util.toDN([ cn, ou, orgDN ], dns, binds));
        });
      }
    } else {
      for (let domain in tree.ldap.domains) {
        domain = tree.ldap.domains[domain];
        model.dn = dapper.util.preferredDN(model.dn, dapper.util.toDN([ cn, ou, domain.dn ], dns, binds));
      }
    }

    model.dns = Array.from(dns).sort();
    model.binds = Array.from(binds).sort();

    Object.$private(model, 'model', group);
    Object.$private(group, 'ldap', model);

    tree.ldap.groups[model.dn] = model;
    tree.ldap.index[model.id] = model;

    model.dns.forEach(dn => {
      return tree.ldap.dns.set(dn, model);
    });
    model.binds.forEach(bind => {
      return tree.ldap.binds.set(bind, model);
    });

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

        givenName: user.metadata.sn || user.name.replace(/^([^\s]+)\s+.*$/, '$1'),
        sn: user.metadata.givenName || user.name.replace(/^.*\s+([^\s]+)$/, '$1'),

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

    if (user.deleted) {
      model.attributes.deleted = true;
      return model;
    }

    if (dapper.config.options.posixAccounts) {
      model.attributes.objectclass.push(dapper.config.posix.type);
      model.attributes.uidNumber = dapper.config.posix.uid++;
      model.attributes.gidNumber = model.attributes.uidNumber;
      model.attributes.homeDirectory = path.join(dapper.config.posix.home,
        model.attributes.uid);
      model.attributes.loginShell = dapper.config.posix.shell;
    }

    for (const multikey in dapper.config.users.multikeys) {
      const values = [];
      for (const mapping of dapper.config.users.multikeys[multikey]) {
        if (model.attributes[mapping]) {
          values.push(model.attributes[mapping]);
        }
      }
      if (values.length) {
        model.attributes[multikey] = values;
      }
    }

    for (const key of dapper.config.users.keys) {
      if (!model.attributes[key] && user.metadata[key]) {
        model.attributes[key] = user.metadata[key];
      }
    }

    for (const property of dapper.config.metadata.users.publish) {
      if (user.metadata[property]) {
        model.attributes[property] = user.metadata[property];
      }
    }

    //////////
    // generate DNs

    const dns = new Set();
    const binds = new Set();

    // uuid - special case
    dns.add(`uuid=${ user.id }, o=uuids`);
    binds.add('o=uuids');

    const emailDomain = model.attributes.email.replace(/^.*@/, '').trim();

    if (dapper.config.options.addEmailDomains && !tree.models.domains[emailDomain]) {
      const domainModel = self.domain({ domain: emailDomain });
      self.ldap.domain(domainModel);
    }

    const dcs = dapper.util.set(Object.keys(tree.ldap.domains));

    if (dapper.config.options.parseEmailToDC) {
      dcs.add(`dc=${ emailDomain.split('.').join(', dc=') }`);
    }

    const orgs = dapper.util.set(model.attributes.o);

    for (const dc of dcs) {
      for (let o of orgs) {
        if (o) {
          if (!tree.models.organizations[o]) {
            let organization = self.organization({ name: o });
            organization = self.ldap.organization(organization);
          }
          o = `o=${ o }`;
        }

        const ou = `ou=${ model.attributes.ou }`;

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
      } else {
        group = self.group({ name: group });
        group = self.ldap.group(group);
      }
      group.attributes.member.push(model.dn);
      group.attributes.memberuid.push(model.attributes.uid);
      model.attributes.memberOf.push(group.dn);
    }

    model.attributes.memberOf.sort();

    model.dns = Array.from(dns).sort();
    model.binds = Array.from(binds).sort();

    Object.$private(model, 'model', user);
    Object.$private(user, 'ldap', model);

    tree.ldap.users[model.dn] = model;
    tree.ldap.index[model.id] = model;

    model.dns.forEach(dn => {
      return tree.ldap.dns.set(dn, model);
    });

    model.binds.forEach(bind => {
      return tree.ldap.binds.set(bind, model);
    });

    return model;
  };

  //////////

  self.session = function(user) {
    const timestamp = dapper.util.timestamp();
    const model = {
      id: dapper.util.id(),
      created: timestamp,
      timestamp,
      user: user.id
    };

    return model;
  };

  //////////

  return self;
}

module.exports = function(dapper) {
  return new Models(dapper);
};
