/*!
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
define([
  'angular',
  './password-directive',
  './password-service'
], function(angular, passwordDirective, passwordService) {

'use strict';

var module = angular.module('bedrock.authn-password', []);

module.directive(passwordDirective);
module.service(passwordService);

/* @ngInject */
module.run(function(brAuthnService) {
  var options = {
    template: requirejs.toUrl('bedrock-authn-password/password.html')
  };
  brAuthnService.register('authn-password', options);
});

return module.name;

});
