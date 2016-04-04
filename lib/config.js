/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
var config = require('bedrock').config;
var path = require('path');

var basePath = '/authn-password';

config['authn-password'] = {};
config['authn-password'].routes = {};
config['authn-password'].routes.login = basePath + '/login';
config['authn-password'].routes.passcode =  basePath + '/passcode';
config['authn-password'].routes.reset =  basePath + '/reset';

// pseudo bower package
var rootPath = path.join(__dirname, '..');
config.requirejs.bower.packages.push({
  path: path.join(rootPath, 'components'),
  manifest: path.join(rootPath, 'bower.json')
});
