/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
var config = require('bedrock').config;
var path = require('path');

// tests
config.mocha.tests.push(path.join(__dirname, '..', 'tests'));
