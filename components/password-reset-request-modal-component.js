/*!
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
define([], function() {

'use strict';

function register(module) {
  module.component('brAuthnPasswordResetRequestModal', {
    bindings: {
      title: '@?brTitle',
      onSubmit: '&brOnSubmit',
      readOnly: '<brReadOnly',
      sysIdentifier: '<brSysIdentifier'
    },
    controller: Ctrl,
    require: {
      stackable: '^stackable'
    },
    templateUrl: requirejs.toUrl(
      'bedrock-authn-password/password-reset-request-modal-component.html')
  });
}

/* @ngInject */
function Ctrl($scope, brAlertService) {
  var self = this;
  self.display = {
    requestForm: true,
    requestSubmitted: false
  };
  self.title = self.title || 'Forgot your password?';

  self.submit = function() {
    self.onSubmit({options: {sysIdentifier: self.sysIdentifier}})
      .then(function(response) {
        self.modalTitle = 'Request received';
        _display('requestSubmitted');
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
