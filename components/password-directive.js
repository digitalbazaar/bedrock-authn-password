/*!
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
define(['angular'], function(angular) {

'use strict';

/* @ngInject */
function factory(brAlertService, brPasswordService, config) {
  return {
    restrict: 'E',
    scope: {
      sysIdentifier: '@brIdentity',
      callback: '&brCallback'
    },
    templateUrl: requirejs.toUrl(
      'bedrock-authn-password/password-directive.html'),
    link: Link
  };

  function Link(scope, element, attrs) {
    var model = scope.model = {};
    model.loading = false;
    model.sysIdentifier = null;
    model.password = null;
    model.multiple = false;

    model.login = function() {
      scope.loading = true;
      brAlertService.clearFeedback();

      var authData = {
        password: model.password,
        sysIdentifier: model.sysIdentifier
      };
      if(scope.sysIdentifier) {
        authData.id = scope.sysIdentifier;
      }

      brPasswordService.login(authData)
        .then(function(data) {
          // if a single 'identity' is returned, login was successful
          if(data.identity) {
            // refresh session information
            // return brSessionService.get();
            return Promise.resolve(data.identity);
          }

          // show multiple identities
          model.multiple = true;
          model.email = data.email;
          model.choices = [];
          angular.forEach(data.identities, function(identity, identityId) {
            model.choices.push({id: identityId, label: identity.label});
          });
          model.sysIdentifier = model.choices[0].id;
          model.loading = false;
        }).catch(function(err) {
          if(err.type === 'ValidationError') {
            err = 'The password you entered was incorrect. Please try again.';
          }
          brAlertService.add('error', err, {scope: scope});
        }).then(function(identity) {
          if(!identity) {
            return;
          }
          return scope.callback({identity: identity});
        }).then(function() {
          scope.$apply();
        });
    };
  }
}

return {brAuthnPassword: factory};

});
