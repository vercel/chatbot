"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.BidiNetworkManager = void 0;
exports.bidiBytesValueToString = bidiBytesValueToString;
var _eventsHelper = require("../utils/eventsHelper");
var _cookieStore = require("../cookieStore");
var network = _interopRequireWildcard(require("../network"));
var bidi = _interopRequireWildcard(require("./third_party/bidiProtocol"));
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class BidiNetworkManager {
  constructor(bidiSession, page, onNavigationResponseStarted) {
    this._session = void 0;
    this._requests = void 0;
    this._page = void 0;
    this._eventListeners = void 0;
    this._onNavigationResponseStarted = void 0;
    this._userRequestInterceptionEnabled = false;
    this._protocolRequestInterceptionEnabled = false;
    this._credentials = void 0;
    this._intercepId = void 0;
    this._session = bidiSession;
    this._requests = new Map();
    this._page = page;
    this._onNavigationResponseStarted = onNavigationResponseStarted;
    this._eventListeners = [_eventsHelper.eventsHelper.addEventListener(bidiSession, 'network.beforeRequestSent', this._onBeforeRequestSent.bind(this)), _eventsHelper.eventsHelper.addEventListener(bidiSession, 'network.responseStarted', this._onResponseStarted.bind(this)), _eventsHelper.eventsHelper.addEventListener(bidiSession, 'network.responseCompleted', this._onResponseCompleted.bind(this)), _eventsHelper.eventsHelper.addEventListener(bidiSession, 'network.fetchError', this._onFetchError.bind(this)), _eventsHelper.eventsHelper.addEventListener(bidiSession, 'network.authRequired', this._onAuthRequired.bind(this))];
  }
  dispose() {
    _eventsHelper.eventsHelper.removeEventListeners(this._eventListeners);
  }
  _onBeforeRequestSent(param) {
    if (param.request.url.startsWith('data:')) return;
    const redirectedFrom = param.redirectCount ? this._requests.get(param.request.request) || null : null;
    const frame = redirectedFrom ? redirectedFrom.request.frame() : param.context ? this._page._frameManager.frame(param.context) : null;
    if (!frame) return;
    if (redirectedFrom) this._requests.delete(redirectedFrom._id);
    let route;
    if (param.intercepts) {
      // We do not support intercepting redirects.
      if (redirectedFrom) {
        var _redirectedFrom$_orig, _redirectedFrom$_orig2;
        let params = {};
        if ((_redirectedFrom$_orig = redirectedFrom._originalRequestRoute) !== null && _redirectedFrom$_orig !== void 0 && _redirectedFrom$_orig._alreadyContinuedHeaders) params = toBidiRequestHeaders((_redirectedFrom$_orig2 = redirectedFrom._originalRequestRoute._alreadyContinuedHeaders) !== null && _redirectedFrom$_orig2 !== void 0 ? _redirectedFrom$_orig2 : []);
        this._session.sendMayFail('network.continueRequest', {
          request: param.request.request,
          ...params
        });
      } else {
        route = new BidiRouteImpl(this._session, param.request.request);
      }
    }
    const request = new BidiRequest(frame, redirectedFrom, param, route);
    this._requests.set(request._id, request);
    this._page._frameManager.requestStarted(request.request, route);
  }
  _onResponseStarted(params) {
    const request = this._requests.get(params.request.request);
    if (!request) return;
    const getResponseBody = async () => {
      throw new Error(`Response body is not available for requests in Bidi`);
    };
    const timings = params.request.timings;
    const startTime = timings.requestTime;
    function relativeToStart(time) {
      if (!time) return -1;
      return time - startTime;
    }
    const timing = {
      startTime: startTime,
      requestStart: relativeToStart(timings.requestStart),
      responseStart: relativeToStart(timings.responseStart),
      domainLookupStart: relativeToStart(timings.dnsStart),
      domainLookupEnd: relativeToStart(timings.dnsEnd),
      connectStart: relativeToStart(timings.connectStart),
      secureConnectionStart: relativeToStart(timings.tlsStart),
      connectEnd: relativeToStart(timings.connectEnd)
    };
    const response = new network.Response(request.request, params.response.status, params.response.statusText, fromBidiHeaders(params.response.headers), timing, getResponseBody, false);
    response._serverAddrFinished();
    response._securityDetailsFinished();
    // "raw" headers are the same as "provisional" headers in Bidi.
    response.setRawResponseHeaders(null);
    response.setResponseHeadersSize(params.response.headersSize);
    this._page._frameManager.requestReceivedResponse(response);
    if (params.navigation) this._onNavigationResponseStarted(params);
  }
  _onResponseCompleted(params) {
    const request = this._requests.get(params.request.request);
    if (!request) return;
    const response = request.request._existingResponse();
    // TODO: body size is the encoded size
    response.setTransferSize(params.response.bodySize);
    response.setEncodedBodySize(params.response.bodySize);

    // Keep redirected requests in the map for future reference as redirectedFrom.
    const isRedirected = response.status() >= 300 && response.status() <= 399;
    const responseEndTime = params.request.timings.responseEnd - response.timing().startTime;
    if (isRedirected) {
      response._requestFinished(responseEndTime);
    } else {
      this._requests.delete(request._id);
      response._requestFinished(responseEndTime);
    }
    response._setHttpVersion(params.response.protocol);
    this._page._frameManager.reportRequestFinished(request.request, response);
  }
  _onFetchError(params) {
    const request = this._requests.get(params.request.request);
    if (!request) return;
    this._requests.delete(request._id);
    const response = request.request._existingResponse();
    if (response) {
      response.setTransferSize(null);
      response.setEncodedBodySize(null);
      response._requestFinished(-1);
    }
    request.request._setFailureText(params.errorText);
    // TODO: support canceled flag
    this._page._frameManager.requestFailed(request.request, params.errorText === 'NS_BINDING_ABORTED');
  }
  _onAuthRequired(params) {
    var _params$response$auth;
    const isBasic = (_params$response$auth = params.response.authChallenges) === null || _params$response$auth === void 0 ? void 0 : _params$response$auth.some(challenge => challenge.scheme.startsWith('Basic'));
    const credentials = this._page._browserContext._options.httpCredentials;
    if (isBasic && credentials) {
      this._session.sendMayFail('network.continueWithAuth', {
        request: params.request.request,
        action: 'provideCredentials',
        credentials: {
          type: 'password',
          username: credentials.username,
          password: credentials.password
        }
      });
    } else {
      this._session.sendMayFail('network.continueWithAuth', {
        request: params.request.request,
        action: 'default'
      });
    }
  }
  async setRequestInterception(value) {
    this._userRequestInterceptionEnabled = value;
    await this._updateProtocolRequestInterception();
  }
  async setCredentials(credentials) {
    this._credentials = credentials;
    await this._updateProtocolRequestInterception();
  }
  async _updateProtocolRequestInterception(initial) {
    const enabled = this._userRequestInterceptionEnabled || !!this._credentials;
    if (enabled === this._protocolRequestInterceptionEnabled) return;
    this._protocolRequestInterceptionEnabled = enabled;
    if (initial && !enabled) return;
    const cachePromise = this._session.send('network.setCacheBehavior', {
      cacheBehavior: enabled ? 'bypass' : 'default'
    });
    let interceptPromise = Promise.resolve(undefined);
    if (enabled) {
      interceptPromise = this._session.send('network.addIntercept', {
        phases: [bidi.Network.InterceptPhase.AuthRequired, bidi.Network.InterceptPhase.BeforeRequestSent],
        urlPatterns: [{
          type: 'pattern'
        }]
        // urlPatterns: [{ type: 'string', pattern: '*' }],
      }).then(r => {
        this._intercepId = r.intercept;
      });
    } else if (this._intercepId) {
      interceptPromise = this._session.send('network.removeIntercept', {
        intercept: this._intercepId
      });
      this._intercepId = undefined;
    }
    await Promise.all([cachePromise, interceptPromise]);
  }
}
exports.BidiNetworkManager = BidiNetworkManager;
class BidiRequest {
  constructor(frame, redirectedFrom, payload, route) {
    var _payload$navigation;
    this.request = void 0;
    this._id = void 0;
    this._redirectedTo = void 0;
    // Only first request in the chain can be intercepted, so this will
    // store the first and only Route in the chain (if any).
    this._originalRequestRoute = void 0;
    this._id = payload.request.request;
    if (redirectedFrom) redirectedFrom._redirectedTo = this;
    // TODO: missing in the spec?
    const postDataBuffer = null;
    this.request = new network.Request(frame._page._browserContext, frame, null, redirectedFrom ? redirectedFrom.request : null, (_payload$navigation = payload.navigation) !== null && _payload$navigation !== void 0 ? _payload$navigation : undefined, payload.request.url, 'other', payload.request.method, postDataBuffer, fromBidiHeaders(payload.request.headers));
    // "raw" headers are the same as "provisional" headers in Bidi.
    this.request.setRawRequestHeaders(null);
    this.request._setBodySize(payload.request.bodySize || 0);
    this._originalRequestRoute = route !== null && route !== void 0 ? route : redirectedFrom === null || redirectedFrom === void 0 ? void 0 : redirectedFrom._originalRequestRoute;
    route === null || route === void 0 || route._setRequest(this.request);
  }
  _finalRequest() {
    let request = this;
    while (request._redirectedTo) request = request._redirectedTo;
    return request;
  }
}
class BidiRouteImpl {
  constructor(session, requestId) {
    this._requestId = void 0;
    this._session = void 0;
    this._request = void 0;
    this._alreadyContinuedHeaders = void 0;
    this._session = session;
    this._requestId = requestId;
  }
  _setRequest(request) {
    this._request = request;
  }
  async continue(overrides) {
    // Firefox does not update content-length header.
    let headers = overrides.headers || this._request.headers();
    if (overrides.postData && headers) {
      headers = headers.map(header => {
        if (header.name.toLowerCase() === 'content-length') return {
          name: header.name,
          value: overrides.postData.byteLength.toString()
        };
        return header;
      });
    }
    this._alreadyContinuedHeaders = headers;
    await this._session.sendMayFail('network.continueRequest', {
      request: this._requestId,
      url: overrides.url,
      method: overrides.method,
      ...toBidiRequestHeaders(this._alreadyContinuedHeaders),
      body: overrides.postData ? {
        type: 'base64',
        value: Buffer.from(overrides.postData).toString('base64')
      } : undefined
    });
  }
  async fulfill(response) {
    const base64body = response.isBase64 ? response.body : Buffer.from(response.body).toString('base64');
    await this._session.sendMayFail('network.provideResponse', {
      request: this._requestId,
      statusCode: response.status,
      reasonPhrase: network.statusText(response.status),
      ...toBidiResponseHeaders(response.headers),
      body: {
        type: 'base64',
        value: base64body
      }
    });
  }
  async abort(errorCode) {
    await this._session.sendMayFail('network.failRequest', {
      request: this._requestId
    });
  }
}
function fromBidiHeaders(bidiHeaders) {
  const result = [];
  for (const {
    name,
    value
  } of bidiHeaders) result.push({
    name,
    value: bidiBytesValueToString(value)
  });
  return result;
}
function toBidiRequestHeaders(allHeaders) {
  const bidiHeaders = toBidiHeaders(allHeaders);
  return {
    headers: bidiHeaders
  };
}
function toBidiResponseHeaders(headers) {
  const setCookieHeaders = headers.filter(h => h.name.toLowerCase() === 'set-cookie');
  const otherHeaders = headers.filter(h => h.name.toLowerCase() !== 'set-cookie');
  const rawCookies = setCookieHeaders.map(h => (0, _cookieStore.parseRawCookie)(h.value));
  const cookies = rawCookies.filter(Boolean).map(c => {
    return {
      ...c,
      value: {
        type: 'string',
        value: c.value
      },
      sameSite: toBidiSameSite(c.sameSite)
    };
  });
  return {
    cookies,
    headers: toBidiHeaders(otherHeaders)
  };
}
function toBidiHeaders(headers) {
  return headers.map(({
    name,
    value
  }) => ({
    name,
    value: {
      type: 'string',
      value
    }
  }));
}
function bidiBytesValueToString(value) {
  if (value.type === 'string') return value.value;
  if (value.type === 'base64') return Buffer.from(value.type, 'base64').toString('binary');
  return 'unknown value type: ' + value.type;
}
function toBidiSameSite(sameSite) {
  if (!sameSite) return undefined;
  if (sameSite === 'Strict') return bidi.Network.SameSite.Strict;
  if (sameSite === 'Lax') return bidi.Network.SameSite.Lax;
  return bidi.Network.SameSite.None;
}