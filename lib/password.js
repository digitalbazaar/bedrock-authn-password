/*
 * Bedrock HTTP password module.
 *
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
/* jshint node: true */
'use strict';

var async = require('async');
var auth = require('./auth');
var bedrock = require('bedrock');
var docs = require('bedrock-docs');
var brExpress = require('bedrock-express');
var brIdentity = require('bedrock-identity');
var brPassport = require('bedrock-passport');
var database = require('bedrock-mongodb');
var rest = require('bedrock-rest');
var url = require('url');
var views = require('bedrock-views');

var BedrockError = bedrock.util.BedrockError;
var getDefaultViewVars = views.getDefaultViewVars;
var validate = require('bedrock-validation').validate;

// module API
var api = {};
module.exports = api;

require('./config');
var routes = bedrock.config['authn-password'].routes;

bedrock.events.on('bedrock.test.configure', function() {
  // load test config
  require('./test.config');
});

// configure passport before serving static files
bedrock.events.on('bedrock-express.configure.static', function() {
  var PasswordStrategy = require('./PasswordStrategy');
  brPassport.use({
    strategy: new PasswordStrategy()
  });
});

// add routes
bedrock.events.on('bedrock-express.configure.routes', function(app) {
  app.get(routes.login, rest.makeResourceHandler());
  docs.annotate.get(routes.login, {hide: true});

  app.post(routes.login,
    validate('services.session.postLogin'),
    function(req, res, next) {
      auth.login(req, res, next, function(err, user, choice) {
        if(err) {
          return next(err);
        }
        var out = {};
        // multiple identities matched credentials
        if(!user) {
          out.email = choice.email;
          out.identities = choice.identities;
        } else {
          out.identity = user.identity;
        }
        res.json(out);
      });
    });
  docs.annotate.post(routes.login, {
    description: 'Perform a login by posting a username and password.',
    schema: 'services.session.postLogin',
    responses: {
      200: 'The login was successful.',
      400: 'The login was unsuccessful.'
    }
  });

  // FIXME: this code is untested
  app.post(routes.reset,
    validate('services.session.postPasswordReset'),
    function(req, res, next) {
      // either an identity slug or email address
      var identifier = req.body.sysIdentifier;
      async.waterfall([
        function(callback) {
          auth.resolveIdentityIdentifier(identifier, callback);
        },
        function(identityIds, callback) {
          // try to set password for all identities until one is successful
          var success = 0;
          async.until(function() {return success !== 0;}, function(callback) {
            if(identityIds.length === 0) {
              success = -1;
              return callback();
            }
            var next = identityIds.shift();
            var identity = bedrock.util.clone(req.body);
            identity.id = next;
            auth.setPassword({id: next}, identity, function(err) {
              if(!err) {
                success = 1;
              }
              callback();
            });
          }, function(err) {
            callback(null, success === 1);
          });
        },
        function(success, callback) {
          if(!success) {
            return callback(new BedrockError(
              'The password reset failed for the given identity.',
              'PasswordResetFailed', {
                sysIdentifier: req.body.sysIdentifier,
                httpStatusCode: 403,
                'public': true}));
          }
          callback();
        }
      ], function(err) {
        if(err) {
          return next(err);
        }
        res.sendStatus(204);
      });
    });
  docs.annotate.post(routes.reset, {
    description: 'Resets a password given an email address and passcode.',
    schema: 'services.session.postPasswordReset',
    responses: {
      204: 'The password reset was successful.',
      403: 'The password reset failed.'
    }
  });

  // FIXME: this code is untested
  app.get(routes.passcode,
    validate({query: 'services.session.getPasscodeQuery'}),
    function(req, res, next) {
    getDefaultViewVars(req, function(err, vars) {
      if(err) {
        return next(err);
      }
      if('passcode' in req.query) {
        vars.idp.sysPasscode = req.query.passcode;
      }
      res.render('passcode.html', vars);
    });
  });
  docs.annotate.get(routes.passcode, {hide: true});

  // FIXME: this code is untested
  app.post(routes.passcode,
    validate('services.session.postPasscode'),
    function(req, res, next) {
      var identifier = req.body.sysIdentifier;
      async.waterfall([
        function(callback) {
          auth.resolveIdentityIdentifier(identifier, callback);
        },
        function(identityIds, callback) {
          // identity not found
          if(identityIds.length === 0) {
            return callback(new BedrockError(
              'The given email address is not registered.',
              'otFound', {
                sysIdentifier: req.body.sysIdentifier,
                httpStatusCode: 404,
                'public': true
              }));
          }
          // look up identities
          var query = {id: {$in: []}};
          identityIds.forEach(function(identityId) {
            query.id.$in.push(database.hash(identityId));
          });
          brIdentity.getAll(
            null, query, {identity: true}, function(err, records) {
              if(err) {
                return callback(err);
              }
              // send passcode for every identity match
              var identities = [];
              records.forEach(function(record) {
                identities.push(record.identity);
              });
              // determine passcode usage based on query param
              var usage = 'reset';
              if(req.query.usage === 'verify') {
                usage = 'verify';
              } else if(req.query.usage === 'reset') {
                usage = 'reset';
              }
              auth.sendPasscodes(identities, usage, callback);
            });
        }
      ], function(err) {
        if(err) {
          return next(err);
        }
        res.sendStatus(204);
      });
    });
  docs.annotate.post(routes.passcode, {
    description: 'Send a password reset passcode to the email associated ' +
      'with the given system identifier.',
    schema: 'services.session.postPasscode',
    responses: {
      204: 'The passcode was successfully transmitted to the registered ' +
        'email address.',
      404: 'The given system identifier does not exist in the system.'
    }
  });
});  // end routes

/* FIXME: Remove if not needed
bedrock.events.on('bedrock-express.configure.errorHandlers', function(app) {
  // handle JSON/JSON-LD errors first
  app.use(brExpress.middleware.jsonErrorHandler());
  // handle permission denied by sending login page
  app.use(function(err, req, res, next) {
    if(err.name !== 'PermissionDenied') {
      return next(err);
    }

    // don't send login page if the method isn't GET or a POST using
    // content type 'application/x-www-form-urlencoded'
    if(!(req.method === 'GET' ||
      (req.method === 'POST' && req.is('urlencoded')))) {
      return next(err);
    }

    // not authenticated, send login page
    getDefaultViewVars(req, function(err, vars) {
      if(err) {
        return next(err);
      }

      // queue current request if not to /session/login
      var parsed = url.parse(req.url, true);
      if(parsed.pathname !== routes.login) {
        vars.queuedRequest = {
          method: req.method,
          url: req.protocol + '://' + req.get('Host') + req.url,
          body: req.body || {}
        };
      }
      res.render('main.html', vars);
    });
  });
});
*/

api.login = auth.login;
