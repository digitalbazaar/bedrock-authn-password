/*!
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
define(['angular'], function(angular) {

'use strict';

function register(module) {
  module.component('brAuthnPassword', {
    bindings: {
      sysId: '@brIdentity',
      onLogin: '&brOnLogin'
    },
    controller: Ctrl,
    templateUrl:
      requirejs.toUrl('bedrock-authn-password/password-component.html')
  });
}

/* @ngInject */
function Ctrl($scope, brAlertService, brPasswordService, config) {
  var self = this;
  self.loading = false;
  self.multiple = false;
  self.password = null;
  self.sysIdentifier = null;
  self.showModal = {
    passwordReset: false
  };

  self.login = function() {
    self.loading = true;
    brAlertService.clearFeedback();

    var authData = {
      password: self.password,
      sysIdentifier: self.sysIdentifier
    };
    if(self.sysId) {
      authData.id = self.sysId;
    }
    brPasswordService.login(authData)
      .then(function(data) {
        // if a single 'identity' is returned, login was successful
        if(data.identity) {
          return Promise.resolve(data.identity);
        }

        // show multiple identities
        self.multiple = true;
        self.email = data.email;
        self.choices = [];
        angular.forEach(data.identities, function(identity, identityId) {
          self.choices.push({id: identityId, label: identity.label});
        });
        self.sysIdentifier = self.choices[0].id;
        self.loading = false;
      }).catch(function(err) {
        if(err.type === 'ValidationError') {
          err = 'The password you entered was incorrect. Please try again.';
        }
        brAlertService.add('error', err, {scope: $scope});
      }).then(function(identity) {
        if(!identity) {
          return;
        }
        return self.onLogin({identity: identity});
      }).then(function() {
        self.loading = false;
        $scope.$apply();
      });
  };

  self.sendPasscode = function(options) {
    return brPasswordService.sendPasscode({
      sysIdentifier: options.sysIdentifier
    });
  };
}

return register;

});
