/*!
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
define([], function() {

'use strict';

function register(module) {
  module.component('brAuthnPasswordReset', {
    bindings: {
      onComplete: '&brOnComplete'
    },
    controller: Ctrl,
    templateUrl:
      requirejs.toUrl('bedrock-authn-password/password-reset-component.html')
  });
}

/* @ngInject */
function Ctrl() {
  var self = this;
  self.sysPassword = '';
  self.loading = false;

  self.submit = function() {
    self.onComplete({password: self.sysPassword});
  };
}

return register;

});
