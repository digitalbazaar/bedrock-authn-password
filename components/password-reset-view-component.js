/*!
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
define([], function() {

'use strict';

function register(module) {
  module.component('brAuthnPasswordResetView', {
    controller: Ctrl,
    templateUrl: requirejs.toUrl(
      'bedrock-authn-password/password-reset-view-component.html')
  });
}

/* @ngInject */
function Ctrl($location, $scope, brAlertService, brPasswordService) {
  var self = this;
  self.display = {
    reset: true,
    success: false
  };
  var query = $location.search();

  if(!(query.id && query.passcode)) {
    $location.url('/');
  }

  self.resetPassword = function(password) {
    var options = {
      sysIdentifier: query.id,
      sysPasscode: query.passcode,
      sysPasswordNew: password
    };
    brPasswordService.resetPassword(options)
      .then(function() {
        _display('success');
      })
      .catch(function(err) {
        brAlertService.add('error', err, {scope: $scope});
      })
      .then(function() {
        $scope.$apply();
      });
  };

  function _display(showProperty) {
    for(var propertyName in self.display) {
      self.display[propertyName] = false;
    }
    self.display[showProperty] = true;
  }
}

return register;

});
