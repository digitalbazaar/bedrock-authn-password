/*!
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
define([], function() {

'use strict';

/* @ngInject */
function factory($http, brSessionService) {
  var service = {};

  service.login = function(authData) {
    // POST identity for verification and to establish session
    // TODO: make URL configurable
    return Promise.resolve($http.post('/authn-password/login', authData))
      .then(function(response) {
        return response.data;
      }).then(function(identity) {
        // refresh session, ignore error
        return brSessionService.get()
          .catch(function() {}).then(function() {
          return identity;
        });
      });
  };

  return service;
}

return {brPasswordService: factory};
});
