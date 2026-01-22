"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.emptyPlatform = void 0;
var _colors = require("../utils/isomorphic/colors");
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const noopZone = {
  push: () => noopZone,
  pop: () => noopZone,
  run: func => func(),
  data: () => undefined
};
const emptyPlatform = exports.emptyPlatform = {
  name: 'empty',
  boxedStackPrefixes: () => [],
  calculateSha1: async () => {
    throw new Error('Not implemented');
  },
  colors: _colors.webColors,
  createGuid: () => {
    throw new Error('Not implemented');
  },
  defaultMaxListeners: () => 10,
  env: {},
  fs: () => {
    throw new Error('Not implemented');
  },
  inspectCustom: undefined,
  isDebugMode: () => false,
  isJSDebuggerAttached: () => false,
  isLogEnabled(name) {
    return false;
  },
  isUnderTest: () => false,
  log(name, message) {},
  path: () => {
    throw new Error('Function not implemented.');
  },
  pathSeparator: '/',
  showInternalStackFrames: () => false,
  streamFile(path, writable) {
    throw new Error('Streams are not available');
  },
  streamReadable: channel => {
    throw new Error('Streams are not available');
  },
  streamWritable: channel => {
    throw new Error('Streams are not available');
  },
  zones: {
    empty: noopZone,
    current: () => noopZone
  }
};