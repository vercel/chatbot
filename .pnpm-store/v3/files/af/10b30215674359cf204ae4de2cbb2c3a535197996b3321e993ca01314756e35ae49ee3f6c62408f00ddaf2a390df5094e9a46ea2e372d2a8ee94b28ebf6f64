"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.nodePlatform = void 0;
exports.setBoxedStackPrefixes = setBoxedStackPrefixes;
var _crypto = _interopRequireDefault(require("crypto"));
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var util = _interopRequireWildcard(require("util"));
var _stream = require("stream");
var _events = require("events");
var _utilsBundle = require("../../utilsBundle");
var _debugLogger = require("./debugLogger");
var _zones = require("./zones");
var _debug = require("./debug");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
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

const pipelineAsync = util.promisify(_stream.pipeline);
class NodeZone {
  constructor(zone) {
    this._zone = void 0;
    this._zone = zone;
  }
  push(data) {
    return new NodeZone(this._zone.with('apiZone', data));
  }
  pop() {
    return new NodeZone(this._zone.without('apiZone'));
  }
  run(func) {
    return this._zone.run(func);
  }
  data() {
    return this._zone.data('apiZone');
  }
}
let boxedStackPrefixes = [];
function setBoxedStackPrefixes(prefixes) {
  boxedStackPrefixes = prefixes;
}
const coreDir = _path.default.dirname(require.resolve('../../../package.json'));
const nodePlatform = exports.nodePlatform = {
  name: 'node',
  boxedStackPrefixes: () => {
    if (process.env.PWDEBUGIMPL) return [];
    return [coreDir, ...boxedStackPrefixes];
  },
  calculateSha1: text => {
    const sha1 = _crypto.default.createHash('sha1');
    sha1.update(text);
    return Promise.resolve(sha1.digest('hex'));
  },
  colors: _utilsBundle.colors,
  coreDir,
  createGuid: () => _crypto.default.randomBytes(16).toString('hex'),
  defaultMaxListeners: () => _events.EventEmitter.defaultMaxListeners,
  fs: () => _fs.default,
  env: process.env,
  inspectCustom: util.inspect.custom,
  isDebugMode: () => !!(0, _debug.debugMode)(),
  isJSDebuggerAttached: () => !!require('inspector').url(),
  isLogEnabled(name) {
    return _debugLogger.debugLogger.isEnabled(name);
  },
  isUnderTest: () => (0, _debug.isUnderTest)(),
  log(name, message) {
    _debugLogger.debugLogger.log(name, message);
  },
  path: () => _path.default,
  pathSeparator: _path.default.sep,
  showInternalStackFrames: () => !!process.env.PWDEBUGIMPL,
  async streamFile(path, stream) {
    await pipelineAsync(_fs.default.createReadStream(path), stream);
  },
  streamReadable: channel => {
    return new ReadableStreamImpl(channel);
  },
  streamWritable: channel => {
    return new WritableStreamImpl(channel);
  },
  zones: {
    current: () => new NodeZone((0, _zones.currentZone)()),
    empty: new NodeZone(_zones.emptyZone)
  }
};
class ReadableStreamImpl extends _stream.Readable {
  constructor(channel) {
    super();
    this._channel = void 0;
    this._channel = channel;
  }
  async _read() {
    const result = await this._channel.read({
      size: 1024 * 1024
    });
    if (result.binary.byteLength) this.push(result.binary);else this.push(null);
  }
  _destroy(error, callback) {
    // Stream might be destroyed after the connection was closed.
    this._channel.close().catch(e => null);
    super._destroy(error, callback);
  }
}
class WritableStreamImpl extends _stream.Writable {
  constructor(channel) {
    super();
    this._channel = void 0;
    this._channel = channel;
  }
  async _write(chunk, encoding, callback) {
    const error = await this._channel.write({
      binary: typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    }).catch(e => e);
    callback(error || null);
  }
  async _final(callback) {
    // Stream might be destroyed after the connection was closed.
    const error = await this._channel.close().catch(e => e);
    callback(error || null);
  }
}