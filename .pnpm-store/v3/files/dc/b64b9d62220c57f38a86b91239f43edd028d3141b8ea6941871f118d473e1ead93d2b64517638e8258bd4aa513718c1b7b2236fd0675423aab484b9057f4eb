"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createConnectionAsync = createConnectionAsync;
exports.createSocket = createSocket;
exports.createTLSSocket = createTLSSocket;
exports.httpsHappyEyeballsAgent = exports.httpHappyEyeballsAgent = void 0;
exports.timingForSocket = timingForSocket;
var _dns = _interopRequireDefault(require("dns"));
var _http = _interopRequireDefault(require("http"));
var _https = _interopRequireDefault(require("https"));
var _net = _interopRequireDefault(require("net"));
var _tls = _interopRequireDefault(require("tls"));
var _assert = require("../../utils/isomorphic/assert");
var _manualPromise = require("../../utils/isomorphic/manualPromise");
var _time = require("../../utils/isomorphic/time");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Implementation(partial) of Happy Eyeballs 2 algorithm described in
// https://www.rfc-editor.org/rfc/rfc8305

// Same as in Chromium (https://source.chromium.org/chromium/chromium/src/+/5666ff4f5077a7e2f72902f3a95f5d553ea0d88d:net/socket/transport_connect_job.cc;l=102)
const connectionAttemptDelayMs = 300;
const kDNSLookupAt = Symbol('kDNSLookupAt');
const kTCPConnectionAt = Symbol('kTCPConnectionAt');
class HttpHappyEyeballsAgent extends _http.default.Agent {
  createConnection(options, oncreate) {
    // There is no ambiguity in case of IP address.
    if (_net.default.isIP(clientRequestArgsToHostName(options))) return _net.default.createConnection(options);
    createConnectionAsync(options, oncreate, /* useTLS */false).catch(err => oncreate === null || oncreate === void 0 ? void 0 : oncreate(err));
  }
}
class HttpsHappyEyeballsAgent extends _https.default.Agent {
  createConnection(options, oncreate) {
    // There is no ambiguity in case of IP address.
    if (_net.default.isIP(clientRequestArgsToHostName(options))) return _tls.default.connect(options);
    createConnectionAsync(options, oncreate, /* useTLS */true).catch(err => oncreate === null || oncreate === void 0 ? void 0 : oncreate(err));
  }
}

// These options are aligned with the default Node.js globalAgent options.
const httpsHappyEyeballsAgent = exports.httpsHappyEyeballsAgent = new HttpsHappyEyeballsAgent({
  keepAlive: true
});
const httpHappyEyeballsAgent = exports.httpHappyEyeballsAgent = new HttpHappyEyeballsAgent({
  keepAlive: true
});
async function createSocket(host, port) {
  return new Promise((resolve, reject) => {
    if (_net.default.isIP(host)) {
      const socket = _net.default.createConnection({
        host,
        port
      });
      socket.on('connect', () => resolve(socket));
      socket.on('error', error => reject(error));
    } else {
      createConnectionAsync({
        host,
        port
      }, (err, socket) => {
        if (err) reject(err);
        if (socket) resolve(socket);
      }, /* useTLS */false).catch(err => reject(err));
    }
  });
}
async function createTLSSocket(options) {
  return new Promise((resolve, reject) => {
    (0, _assert.assert)(options.host, 'host is required');
    if (_net.default.isIP(options.host)) {
      const socket = _tls.default.connect(options);
      socket.on('secureConnect', () => resolve(socket));
      socket.on('error', error => reject(error));
    } else {
      createConnectionAsync(options, (err, socket) => {
        if (err) reject(err);
        if (socket) {
          socket.on('secureConnect', () => resolve(socket));
          socket.on('error', error => reject(error));
        }
      }, true).catch(err => reject(err));
    }
  });
}
async function createConnectionAsync(options, oncreate, useTLS) {
  const lookup = options.__testHookLookup || lookupAddresses;
  const hostname = clientRequestArgsToHostName(options);
  const addresses = await lookup(hostname);
  const dnsLookupAt = (0, _time.monotonicTime)();
  const sockets = new Set();
  let firstError;
  let errorCount = 0;
  const handleError = (socket, err) => {
    if (!sockets.delete(socket)) return;
    ++errorCount;
    firstError !== null && firstError !== void 0 ? firstError : firstError = err;
    if (errorCount === addresses.length) oncreate === null || oncreate === void 0 || oncreate(firstError);
  };
  const connected = new _manualPromise.ManualPromise();
  for (const {
    address
  } of addresses) {
    const socket = useTLS ? _tls.default.connect({
      ...options,
      port: options.port,
      host: address,
      servername: hostname
    }) : _net.default.createConnection({
      ...options,
      port: options.port,
      host: address
    });
    socket[kDNSLookupAt] = dnsLookupAt;

    // Each socket may fire only one of 'connect', 'timeout' or 'error' events.
    // None of these events are fired after socket.destroy() is called.
    socket.on('connect', () => {
      socket[kTCPConnectionAt] = (0, _time.monotonicTime)();
      connected.resolve();
      oncreate === null || oncreate === void 0 || oncreate(null, socket);
      // TODO: Cache the result?
      // Close other outstanding sockets.
      sockets.delete(socket);
      for (const s of sockets) s.destroy();
      sockets.clear();
    });
    socket.on('timeout', () => {
      // Timeout is not an error, so we have to manually close the socket.
      socket.destroy();
      handleError(socket, new Error('Connection timeout'));
    });
    socket.on('error', e => handleError(socket, e));
    sockets.add(socket);
    await Promise.race([connected, new Promise(f => setTimeout(f, connectionAttemptDelayMs))]);
    if (connected.isDone()) break;
  }
}
async function lookupAddresses(hostname) {
  const addresses = await _dns.default.promises.lookup(hostname, {
    all: true,
    family: 0,
    verbatim: true
  });
  let firstFamily = addresses.filter(({
    family
  }) => family === 6);
  let secondFamily = addresses.filter(({
    family
  }) => family === 4);
  // Make sure first address in the list is the same as in the original order.
  if (firstFamily.length && firstFamily[0] !== addresses[0]) {
    const tmp = firstFamily;
    firstFamily = secondFamily;
    secondFamily = tmp;
  }
  const result = [];
  // Alternate ipv6 and ipv4 addresses.
  for (let i = 0; i < Math.max(firstFamily.length, secondFamily.length); i++) {
    if (firstFamily[i]) result.push(firstFamily[i]);
    if (secondFamily[i]) result.push(secondFamily[i]);
  }
  return result;
}
function clientRequestArgsToHostName(options) {
  if (options.hostname) return options.hostname;
  if (options.host) return options.host;
  throw new Error('Either options.hostname or options.host must be provided');
}
function timingForSocket(socket) {
  return {
    dnsLookupAt: socket[kDNSLookupAt],
    tcpConnectionAt: socket[kTCPConnectionAt]
  };
}