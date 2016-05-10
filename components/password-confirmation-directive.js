/*!
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
define([], function() {

'use strict';

// TODO: convert this into a component
function register(module) {
  module.directive('brPasswordConfirmation', factory);
}

function factory() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function(scope, element, attrs, ctrl) {
      var me = attrs.ngModel;
      var matchTo = attrs.brPasswordConfirmation;
      scope.$watchGroup([me, matchTo], function(value) {
        ctrl.$setValidity('inputMatch', value[0] === value[1]);
      });
    }
  };
}

return register;

});
