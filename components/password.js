/*!
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
define([
  'angular',
  './password-service'
], function(angular, passwordService) {

'use strict';

var module = angular.module('bedrock.password', []);

module.service(passwordService);

return module.name;

});
