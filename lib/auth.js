/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
 /* jshint node: true */
'use strict';

var async = require('async');
var bcrypt = require('bcrypt');
var bedrock = require('bedrock');
var brIdentity = require('bedrock-identity');
var brPassport = require('bedrock-passport');
var database = require('bedrock-mongodb');
var BedrockError = bedrock.util.BedrockError;

// module permissions
var PERMISSIONS = bedrock.config.permission.permissions;

// module API
var api = {};
module.exports = api;

bedrock.events.on(
  'bedrock-identity.insert', function(identity, meta, callback) {
  async.auto({
    generatePassword: function(callback) {
      /* Note: If the identity doesn't have a password, generate a fake one
      for them (that will not be known by anyone). This simplifies the code
      path for verifying passwords. */
      if(!('sysPassword' in identity)) {
        identity.sysPassword = _generatePasscode();
      }
      callback();
    },
    generatePasscode: function(callback) {
      // generate new random passcode for identity
      callback(null, _generatePasscode());
    },
    hashPassword: ['generatePassword', function(callback) {
      if(identity.sysHashedPassword === true) {
        // password already hashed
        delete identity.sysHashedPassword;
        return callback(null, identity.sysPassword);
      }
      api.createPasswordHash(identity.sysPassword, callback);
    }],
    hashPasscode: ['generatePasscode', function(callback, results) {
      if(identity.sysHashedPasscode === true) {
        // passcode already hashed
        delete identity.sysHashedPasscode;
        return callback(null, identity.sysPasscode);
      }
      api.createPasswordHash(results.generatePasscode, callback);
    }],
    setMeta: ['hashPassword', 'hashPasscode', function(callback, results) {
      // store hash results
      meta['bedrock-authn-password'] = {
        sysPassword: results.hashPassword,
        sysPasscode: results.hashPasscode
      };
      callback();
    }]
  }, callback);
});

/**
 * Attempt to establish an authorized session for the user that sent the
 * request.
 *
 * @param req the request.
 * @param res the response.
 * @param next the next route handler.
 * @param callback(err, user, choice) called once the operation completes with
 *          the `user` that was logged in or false if there were multiple
 *          choices of users to log in and `choice` will contain the
 *          email address used and a map of identityId => identities that match.
 */
api.login = function(req, res, next, callback) {
  brPassport.authenticate('bedrock-authn-password', function(err, user, info) {
    if(!user) {
      // multiple identity matches
      if(info && info.matches) {
        // get mapping of identity ID to identity
        var choice = {
          email: info.email,
          identities: {}
        };
        return async.each(info.matches, function(id, callback) {
          brIdentity.get(null, id, function(err, identity) {
            if(err) {
              return callback(err);
            }
            choice.identities[id] = identity;
            callback();
          });
        }, function(err) {
          if(err) {
            return callback(err);
          }
          callback(null, false, choice);
        });
      }
      // user not authenticated
      err = new BedrockError(
        'The email address and password combination is incorrect.',
        'InvalidLogin', {'public': true, httpStatusCode: 400});
    }
    if(err) {
      return callback(err);
    }
    req.logIn(user, function(err) {
      callback(err, user);
    });
  })(req, res, next);
};

/**
 * Gets the Identity ID that matches the given identity name (ID or slug). The
 * Identity ID will be null if none is found. If a full identity ID is passed,
 * it will be passed back in the callback if it is valid.
 *
 * @param name the identity name (ID or slug).
 * @param [options] the options to use:
 *          [error] pass a `NotFound` error to the callback if the ID
 *            could not be found.
 * @param callback(err, identityId) called once the operation completes.
 */
api.resolveIdentitySlug = function(name, options, callback) {
  if(typeof options === 'function') {
    callback = options;
    options = {};
  }
  options = options || {};
  database.collections.identity.findOne(
    {$or: [{id: database.hash(name)}, {'identity.sysSlug': name}]},
    {'identity.id': true},
    function(err, result) {
      if(!err) {
        if(result) {
          result = result.identity.id;
        } else if(options.error) {
          err = new BedrockError(
            'Identity not found.', 'NotFound', {
            httpStatusCode: 404,
            public: true
          });
        }
      }
      callback(err, result);
    });
};

/**
 * Gets the Identity ID(s) that match the given email address.
 *
 * @param email the email address.
 * @param callback(err, identityIds) called once the operation completes.
 */
api.resolveEmail = function(email, callback) {
  database.collections.identity.find(
    {'identity.email': email},
    {'identity.id': true}).toArray(function(err, records) {
    if(records) {
      records.forEach(function(record, i) {
        records[i] = record.identity.id;
      });
    }
    callback(err, records);
  });
};

/**
 * Gets the Identity IDs that match the given identifier. The identifier
 * can be an Identity ID, an Identity slug, or an email address.
 *
 * @param identifier the identifier to resolve.
 * @param callback(err, identityIds) called once the operation completes.
 */
api.resolveIdentityIdentifier = function(identifier, callback) {
  // looks like an email
  if(identifier.indexOf('@') !== -1) {
    return api.resolveEmail(identifier, callback);
  }
  // must be an identity or slug
  api.resolveIdentitySlug(identifier, function(err, identityId) {
    if(err) {
      return callback(err);
    }
    if(!identityId) {
      return callback(null, []);
    }
    // arrayify result
    callback(null, [identityId]);
  });
};

/**
 * Sets an Identity's password. This method can optionally check an old password
 * or passcode and will always generate a new passcode and set it as
 * 'sysPasscode'. A new password doesn't have to be set using this method, it
 * can be called to simply generate a new passcode. If 'sysPassword' is
 * provided, it must be the old password and it will be checked. The same
 * applies to 'sysPasscode'. If a new password is to be set, it should be
 * passed as 'sysPasswordNew'.
 *
 * @param actor the Identity performing the action.
 * @param identity the Identity.
 * @param callback(err, changes) called once the operation completes.
 */
api.setPassword = function(actor, identity, callback) {
  // TODO: move sysPassword and sysPasscode to meta
  var changes = {};
  async.auto({
    checkPermission: function(callback) {
      brIdentity.checkPermission(
        actor, PERMISSIONS.IDENTITY_EDIT, {resource: identity}, callback);
    },
    checkPassword: ['checkPermission', function(callback) {
      if('sysPassword' in identity) {
        return api.verifyPassword(identity, callback);
      }
      callback(null, null);
    }],
    checkPasscode: ['checkPermission', function(callback) {
      if('sysPasscode' in identity) {
        return api.verifyPasscode(identity, callback);
      }
      callback(null, null);
    }],
    hashPassword: ['checkPassword', 'checkPasscode', function(
      callback, results) {
      if(results.checkPassword === false) {
        return callback(new BedrockError(
          'Could not update identity password; invalid password.',
          'InvalidPassword'));
      }
      if(results.checkPasscode === false) {
        return callback(new BedrockError(
          'Could not update identity passcode; invalid passcode.',
          'InvalidPasscode'));
      }
      if('sysPasswordNew' in identity) {
        return api.createPasswordHash(identity.sysPasswordNew, callback);
      }
      callback();
    }],
    generatePasscode: ['hashPassword', function(callback, results) {
      if(results.hashPassword) {
        changes.sysPassword = results.hashPassword;
      }
      var passcode = identity.sysPasscode = _generatePasscode();
      api.createPasswordHash(passcode, callback);
    }],
    update: ['generatePasscode', function(callback, results) {
      changes.sysPasscode = results.generatePasscode;
      database.collections.identity.update(
        {id: database.hash(identity.id)},
        {$set: database.buildUpdate(changes, 'identity')},
        database.writeOptions,
        function(err, result) {
          if(err) {
            return callback(err);
          }
          if(result.result.n === 0) {
            return callback(new BedrockError(
              'Could not set Identity password. Identity not found.',
              'NotFound'));
          }
          callback();
        });
    }]
  }, function(err) {
    callback(err, changes);
  });
};

/**
 * Verifies the Identity's passcode against the stored passcode.
 *
 * @param identity the Identity with the passcode to verify.
 * @param callback(err, verified) called once the operation completes.
 */
api.verifyPasscode = function(identity, callback) {
  _verifyPasswordHash(identity, 'passcode', callback);
};

/**
 * Verifies the Identity's password against the stored password.
 *
 * @param identity the Identity with the password to verify.
 * @param callback(err, verified) called once the operation completes.
 */
api.verifyPassword = function(identity, callback) {
  _verifyPasswordHash(identity, 'password', callback);
};

/**
 * Verifies the Identity's passcode against the stored passcode and sets
 * the Identity's email address as verified upon success.
 *
 * @param actor the Identity performing the action.
 * @param identity the Identity with the passcode to verify.
 * @param callback(err, verified) called once the operation completes.
 */
api.verifyEmail = function(actor, identity, callback) {
  async.auto({
    checkPermission: function(callback) {
      brIdentity.checkPermission(
        actor, PERMISSIONS.IDENTITY_EDIT, {resource: identity}, callback);
    },
    verifyPasscode: ['checkPermission', function(callback) {
      _verifyPasswordHash(identity, 'passcode', callback);
    }],
    update: ['verifyPasscode', function(callback, results) {
      if(!results.verifyPasscode) {
        return callback();
      }
      database.collections.identity.update(
        {id: database.hash(identity.id)},
        {$set: {'identity.sysEmailVerified': true}},
        database.writeOptions, callback);
    }]
  }, function(err, results) {
    callback(err, results.verifyPasscode);
  });
};

/**
 * Sends an Identity's or multiple Identity's passcodes to their contact point
 * (eg: email address). The Identities must all have the same contact point and
 * must be populated.
 *
 * @param identities the Identities to send the passcode to.
 * @param usage 'reset' if the passcode is for resetting a password,
 *          'verify' if it is for verifying an email address/contact point.
 * @param callback(err) called once the operation completes.
 */
api.sendPasscodes = function(identities, usage, callback) {
  // FIXME: require actor and check permissions to send email/sms/etc?

  // create event
  var event = {
    type: 'bedrock.Identity.passcodeSent',
    details: {
      usage: usage,
      identities: [],
      email: null
    }
  };

  // generate passcodes for every identity
  async.each(identities, function(identity, callback) {
    // remove password and passcode from identity; this prevents checking
    // passwords/passcodes and only generates a new passcode
    identity = bedrock.util.clone(identity);
    delete identity.sysPassword;
    delete identity.sysPasscode;
    api.setPassword(null, identity, function(err) {
      if(err) {
        return callback(err);
      }
      event.details.identities.push(identity);
      if(!event.details.email) {
        event.details.email = identity.email;
      } else if(event.details.email !== identity.email) {
        return callback(new BedrockError(
          'Could not send Identity passcodes. The identities do not all ' +
          'have the same contact point (eg: email address).',
          'ContactPointMismatch'));
      }
      callback();
    });
  }, function(err) {
    if(err) {
      return callback(err);
    }

    // emit passcode sent event
    bedrock.events.emitLater(event);
    // TODO: limit # emails sent per identity per day
    // TODO: use job scheduler for this
    callback();
  });
};

/**
 * Creates a password hash that can be stored and later used to verify a
 * password at a later point in time.
 *
 * @param password the password to hash.
 * @param callback(err, hash) called once the operation completes.
 */
api.createPasswordHash = function(password, callback) {
  bcrypt.genSalt(function(err, salt) {
    if(err) {
      return callback(err);
    }
    bcrypt.hash(password, salt, function(err, hash) {
      callback(err, 'bcrypt:' + hash);
    });
  });
};

/**
 * Verifies a password against a previously generated password hash. The
 * hash value should have been generated via createPasswordHash() or by
 * a supported legacy method.
 *
 * @param hash the hash value to verify against.
 * @param password the password to verify.
 * @param callback(err, verified, legacy) called once the operation completes.
 */
api.verifyPasswordHash = function(hash, password, callback) {
  var fields = hash.split(':');
  if(fields.length !== 2 && fields.length !== 3) {
    return callback(new BedrockError(
      'Could not verify password hash. Invalid input.',
      'MalformedPasswordHash'));
  }
  // bcrypt hash
  if(fields[0] === 'bcrypt') {
    return bcrypt.compare(password, fields[1], function(err, verified) {
      callback(err, verified, false);
    });
  }
  // unknown algorithm
  callback(new BedrockError(
    'Could not verify password hash. Invalid input.',
    'MalformedPasswordHash'));
};

// static passcode character set
var CHARSET = (
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz');

/**
 * Generates a passcode for resetting a password. This passcode must be
 * stored using a password hash in the database.
 *
 * @return the generated passcode.
 */
function _generatePasscode() {
  // passcodes are 8 chars long
  var rval = '';
  for(var i = 0; i < 8; ++i) {
    rval += CHARSET.charAt(parseInt(Math.random() * (CHARSET.length - 1), 10));
  }
  return rval;
}

/**
 * A helper function for verifying passwords and passcodes.
 *
 * @param identity the Identity with the password or passcode.
 * @param type 'password' or 'passcode'.
 * @param callback(err, verified) called once the operation completes.
 */
function _verifyPasswordHash(identity, type, callback) {
  var field = 'sys' + type[0].toUpperCase() + type.substr(1);
  async.waterfall([
    function(callback) {
      // get status and <type> from db
      var fields = {'identity.sysStatus': true};
      var passName = 'bedrock-authn-password';
      var metaPassword = 'meta.' + passName + '.' + field;
      fields[metaPassword] = true;
      database.collections.identity.findOne(
        {id: database.hash(identity.id)}, fields, function(err, record) {
          callback(err, record);
        });
    },
    function(record, callback) {
      if(!record) {
        return callback(new BedrockError(
          'Could not verify Identity ' + type + '. Identity not found.',
          'NotFound'));
      }
      if(record.identity.sysStatus !== 'active') {
        return callback(new BedrockError(
          'Could not verify Identity ' + type + '. Identity is not active.',
          'IdentityInactive'));
      }
      callback(null, record.meta['bedrock-authn-password'][field]);
    },
    function(hash, callback) {
      api.verifyPasswordHash(hash, identity[field], callback);
    },
    function(verified, legacy) {
      if(!verified || !legacy) {
        return callback(null, verified);
      }

      // update legacy password
      api.createPasswordHash(identity[field], function(err, hash) {
        var update = {$set: {}};
        update.$set['identity.' + field] = hash;
        database.collections.identity.update(
          {id: database.hash(identity.id)}, update,
          database.writeOptions,
          function(err) {
            callback(err, verified);
          });
      });
      callback(null, verified);
    }
  ], callback);
}
