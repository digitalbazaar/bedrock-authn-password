/*
 * Copyright (c) 2012-2016 Digital Bazaar, Inc. All rights reserved.
 */
var constants = require('bedrock').config.constants;
var schemas = require('bedrock-validation').schemas;

var passcode = require('./passcode');
var password = require('./password');
var visibility = require('./propertyVisibility');

var getPasscodeQuery = {
  type: 'object',
  properties: {
    passcode: {
      required: false,
      type: 'string',
      minLength: 1
    }
  }
};

var postPasscode = {
  title: 'Passcode',
  description: 'Create a passcode.',
  type: 'object',
  properties: {
    sysIdentifier: {
      required: true,
      type: [schemas.identifier(), schemas.slug(), schemas.email()]
    }
  },
  additionalProperties: false
};

var postPassword = {
  title: 'Password',
  description: 'Create a password.',
  type: 'object',
  properties: {
    id: schemas.identifier(),
    sysPassword: password(),
    sysPasswordNew: password()
  },
  additionalProperties: false
};

var postPasswordReset = {
  title: 'Reset password',
  description: 'Reset a password.',
  type: 'object',
  properties: {
    sysIdentifier: {
      required: true,
      type: [schemas.identifier(), schemas.slug(), schemas.email()]
    },
    sysPasscode: passcode(),
    sysPasswordNew: password()
  },
  additionalProperties: false
};

var postLogin = {
  title: 'Login',
  description: 'Login.',
  type: 'object',
  properties: {
    id: schemas.identifier({required: false}),
    sysIdentifier: {
      required: true,
      type: [schemas.slug(), schemas.email(), schemas.identifier()]
    },
    password: password()
  },
  additionalProperties: false
};

module.exports.getPasscodeQuery = function() {
  return getPasscodeQuery;
};
module.exports.postPasscode = function() {
  return postPasscode;
};
module.exports.postPassword = function() {
  return postPassword;
};
module.exports.postPasswordReset = function() {
  return postPasswordReset;
};
module.exports.postLogin = function() {
  return postLogin;
};
