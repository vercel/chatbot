"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LocalUtilsDispatcher = void 0;
var _dispatcher = require("./dispatcher");
var _instrumentation = require("../../server/instrumentation");
var localUtils = _interopRequireWildcard(require("../localUtils"));
var _userAgent = require("../utils/userAgent");
var _deviceDescriptors = require("../deviceDescriptors");
var _jsonPipeDispatcher = require("../dispatchers/jsonPipeDispatcher");
var _progress = require("../progress");
var _socksInterceptor = require("../socksInterceptor");
var _transport = require("../transport");
var _network = require("../utils/network");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

class LocalUtilsDispatcher extends _dispatcher.Dispatcher {
  constructor(scope, playwright) {
    const _localUtils = new _instrumentation.SdkObject(playwright, 'localUtils', 'localUtils');
    const deviceDescriptors = Object.entries(_deviceDescriptors.deviceDescriptors).map(([name, descriptor]) => ({
      name,
      descriptor
    }));
    super(scope, _localUtils, 'LocalUtils', {
      deviceDescriptors
    });
    this._type_LocalUtils = void 0;
    this._harBackends = new Map();
    this._stackSessions = new Map();
    this._type_LocalUtils = true;
  }
  async zip(params) {
    return await localUtils.zip(this._stackSessions, params);
  }
  async harOpen(params, metadata) {
    return await localUtils.harOpen(this._harBackends, params);
  }
  async harLookup(params, metadata) {
    return await localUtils.harLookup(this._harBackends, params);
  }
  async harClose(params, metadata) {
    return await localUtils.harClose(this._harBackends, params);
  }
  async harUnzip(params, metadata) {
    return await localUtils.harUnzip(params);
  }
  async tracingStarted(params, metadata) {
    return await localUtils.tracingStarted(this._stackSessions, params);
  }
  async traceDiscarded(params, metadata) {
    return await localUtils.traceDiscarded(this._stackSessions, params);
  }
  async addStackToTracingNoReply(params, metadata) {
    return await localUtils.addStackToTracingNoReply(this._stackSessions, params);
  }
  async connect(params, metadata) {
    const controller = new _progress.ProgressController(metadata, this._object);
    controller.setLogName('browser');
    return await controller.run(async progress => {
      var _params$exposeNetwork;
      const wsHeaders = {
        'User-Agent': (0, _userAgent.getUserAgent)(),
        'x-playwright-proxy': (_params$exposeNetwork = params.exposeNetwork) !== null && _params$exposeNetwork !== void 0 ? _params$exposeNetwork : '',
        ...params.headers
      };
      const wsEndpoint = await urlToWSEndpoint(progress, params.wsEndpoint);
      const transport = await _transport.WebSocketTransport.connect(progress, wsEndpoint, wsHeaders, true, 'x-playwright-debug-log');
      const socksInterceptor = new _socksInterceptor.SocksInterceptor(transport, params.exposeNetwork, params.socksProxyRedirectPortForTest);
      const pipe = new _jsonPipeDispatcher.JsonPipeDispatcher(this);
      transport.onmessage = json => {
        if (socksInterceptor.interceptMessage(json)) return;
        const cb = () => {
          try {
            pipe.dispatch(json);
          } catch (e) {
            transport.close();
          }
        };
        if (params.slowMo) setTimeout(cb, params.slowMo);else cb();
      };
      pipe.on('message', message => {
        transport.send(message);
      });
      transport.onclose = reason => {
        socksInterceptor === null || socksInterceptor === void 0 || socksInterceptor.cleanup();
        pipe.wasClosed(reason);
      };
      pipe.on('close', () => transport.close());
      return {
        pipe,
        headers: transport.headers
      };
    }, params.timeout || 0);
  }
}
exports.LocalUtilsDispatcher = LocalUtilsDispatcher;
async function urlToWSEndpoint(progress, endpointURL) {
  var _progress$timeUntilDe;
  if (endpointURL.startsWith('ws')) return endpointURL;
  progress === null || progress === void 0 || progress.log(`<ws preparing> retrieving websocket url from ${endpointURL}`);
  const fetchUrl = new URL(endpointURL);
  if (!fetchUrl.pathname.endsWith('/')) fetchUrl.pathname += '/';
  fetchUrl.pathname += 'json';
  const json = await (0, _network.fetchData)({
    url: fetchUrl.toString(),
    method: 'GET',
    timeout: (_progress$timeUntilDe = progress === null || progress === void 0 ? void 0 : progress.timeUntilDeadline()) !== null && _progress$timeUntilDe !== void 0 ? _progress$timeUntilDe : 30_000,
    headers: {
      'User-Agent': (0, _userAgent.getUserAgent)()
    }
  }, async (params, response) => {
    return new Error(`Unexpected status ${response.statusCode} when connecting to ${fetchUrl.toString()}.\n` + `This does not look like a Playwright server, try connecting via ws://.`);
  });
  progress === null || progress === void 0 || progress.throwIfAborted();
  const wsUrl = new URL(endpointURL);
  let wsEndpointPath = JSON.parse(json).wsEndpointPath;
  if (wsEndpointPath.startsWith('/')) wsEndpointPath = wsEndpointPath.substring(1);
  if (!wsUrl.pathname.endsWith('/')) wsUrl.pathname += '/';
  wsUrl.pathname += wsEndpointPath;
  wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return wsUrl.toString();
}