"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.GlobalAPIRequestContext = exports.BrowserContextAPIRequestContext = exports.APIRequestContext = void 0;
exports.createProxyAgent = createProxyAgent;
var _http = _interopRequireDefault(require("http"));
var _https = _interopRequireDefault(require("https"));
var _stream = require("stream");
var _tls = require("tls");
var _url = _interopRequireDefault(require("url"));
var zlib = _interopRequireWildcard(require("zlib"));
var _timeoutSettings = require("./timeoutSettings");
var _utils = require("../utils");
var _crypto = require("./utils/crypto");
var _userAgent = require("./utils/userAgent");
var _utilsBundle = require("../utilsBundle");
var _browserContext = require("./browserContext");
var _cookieStore = require("./cookieStore");
var _formData = require("./formData");
var _instrumentation = require("./instrumentation");
var _progress = require("./progress");
var _socksClientCertificatesInterceptor = require("./socksClientCertificatesInterceptor");
var _happyEyeballs = require("./utils/happyEyeballs");
var _tracing = require("./trace/recorder/tracing");
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
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class APIRequestContext extends _instrumentation.SdkObject {
  static findResponseBody(guid) {
    for (const request of APIRequestContext.allInstances) {
      const body = request.fetchResponses.get(guid);
      if (body) return body;
    }
    return undefined;
  }
  constructor(parent) {
    super(parent, 'request-context');
    this.fetchResponses = new Map();
    this.fetchLog = new Map();
    this._activeProgressControllers = new Set();
    this._closeReason = void 0;
    APIRequestContext.allInstances.add(this);
  }
  _disposeImpl() {
    APIRequestContext.allInstances.delete(this);
    this.fetchResponses.clear();
    this.fetchLog.clear();
    this.emit(APIRequestContext.Events.Dispose);
  }
  disposeResponse(fetchUid) {
    this.fetchResponses.delete(fetchUid);
    this.fetchLog.delete(fetchUid);
  }
  _storeResponseBody(body) {
    const uid = (0, _crypto.createGuid)();
    this.fetchResponses.set(uid, body);
    return uid;
  }
  async fetch(params, metadata) {
    var _params$method;
    const defaults = this._defaultOptions();
    const headers = {
      'user-agent': defaults.userAgent,
      'accept': '*/*',
      'accept-encoding': 'gzip,deflate,br'
    };
    if (defaults.extraHTTPHeaders) {
      for (const {
        name,
        value
      } of defaults.extraHTTPHeaders) setHeader(headers, name, value);
    }
    if (params.headers) {
      for (const {
        name,
        value
      } of params.headers) setHeader(headers, name, value);
    }
    const requestUrl = new URL((0, _utils.constructURLBasedOnBaseURL)(defaults.baseURL, params.url));
    if (params.encodedParams) {
      requestUrl.search = params.encodedParams;
    } else if (params.params) {
      for (const {
        name,
        value
      } of params.params) requestUrl.searchParams.append(name, value);
    }
    const credentials = this._getHttpCredentials(requestUrl);
    if ((credentials === null || credentials === void 0 ? void 0 : credentials.send) === 'always') setBasicAuthorizationHeader(headers, credentials);
    const method = ((_params$method = params.method) === null || _params$method === void 0 ? void 0 : _params$method.toUpperCase()) || 'GET';
    const proxy = defaults.proxy;
    let agent;
    // We skip 'per-context' in order to not break existing users. 'per-context' was previously used to
    // workaround an upstream Chromium bug. Can be removed in the future.
    if (proxy && proxy.server !== 'per-context' && !shouldBypassProxy(requestUrl, proxy.bypass)) agent = createProxyAgent(proxy);
    const timeout = defaults.timeoutSettings.timeout(params);
    const deadline = timeout && (0, _utils.monotonicTime)() + timeout;
    const options = {
      method,
      headers,
      agent,
      maxRedirects: params.maxRedirects === 0 ? -1 : params.maxRedirects === undefined ? 20 : params.maxRedirects,
      timeout,
      deadline,
      ...(0, _socksClientCertificatesInterceptor.getMatchingTLSOptionsForOrigin)(this._defaultOptions().clientCertificates, requestUrl.origin),
      __testHookLookup: params.__testHookLookup
    };
    // rejectUnauthorized = undefined is treated as true in Node.js 12.
    if (params.ignoreHTTPSErrors || defaults.ignoreHTTPSErrors) options.rejectUnauthorized = false;
    const postData = serializePostData(params, headers);
    if (postData) setHeader(headers, 'content-length', String(postData.byteLength));
    const controller = new _progress.ProgressController(metadata, this);
    const fetchResponse = await controller.run(progress => {
      return this._sendRequestWithRetries(progress, requestUrl, options, postData, params.maxRetries);
    });
    const fetchUid = this._storeResponseBody(fetchResponse.body);
    this.fetchLog.set(fetchUid, controller.metadata.log);
    const failOnStatusCode = params.failOnStatusCode !== undefined ? params.failOnStatusCode : !!defaults.failOnStatusCode;
    if (failOnStatusCode && (fetchResponse.status < 200 || fetchResponse.status >= 400)) {
      let responseText = '';
      if (fetchResponse.body.byteLength) {
        let text = fetchResponse.body.toString('utf8');
        if (text.length > 1000) text = text.substring(0, 997) + '...';
        responseText = `\nResponse text:\n${text}`;
      }
      throw new Error(`${fetchResponse.status} ${fetchResponse.statusText}${responseText}`);
    }
    return {
      ...fetchResponse,
      fetchUid
    };
  }
  _parseSetCookieHeader(responseUrl, setCookie) {
    if (!setCookie) return [];
    const url = new URL(responseUrl);
    // https://datatracker.ietf.org/doc/html/rfc6265#section-5.1.4
    const defaultPath = '/' + url.pathname.substr(1).split('/').slice(0, -1).join('/');
    const cookies = [];
    for (const header of setCookie) {
      // Decode cookie value?
      const cookie = parseCookie(header);
      if (!cookie) continue;
      // https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.3
      if (!cookie.domain) cookie.domain = url.hostname;else (0, _utils.assert)(cookie.domain.startsWith('.') || !cookie.domain.includes('.'));
      if (!(0, _cookieStore.domainMatches)(url.hostname, cookie.domain)) continue;
      // https://datatracker.ietf.org/doc/html/rfc6265#section-5.2.4
      if (!cookie.path || !cookie.path.startsWith('/')) cookie.path = defaultPath;
      cookies.push(cookie);
    }
    return cookies;
  }
  async _updateRequestCookieHeader(url, headers) {
    if (getHeader(headers, 'cookie') !== undefined) return;
    const cookies = await this._cookies(url);
    if (cookies.length) {
      const valueArray = cookies.map(c => `${c.name}=${c.value}`);
      setHeader(headers, 'cookie', valueArray.join('; '));
    }
  }
  async _sendRequestWithRetries(progress, url, options, postData, maxRetries) {
    maxRetries !== null && maxRetries !== void 0 ? maxRetries : maxRetries = 0;
    let backoff = 250;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await this._sendRequest(progress, url, options, postData);
      } catch (e) {
        e = (0, _socksClientCertificatesInterceptor.rewriteOpenSSLErrorIfNeeded)(e);
        if (maxRetries === 0) throw e;
        if (i === maxRetries || options.deadline && (0, _utils.monotonicTime)() + backoff > options.deadline) throw new Error(`Failed after ${i + 1} attempt(s): ${e}`);
        // Retry on connection reset only.
        if (e.code !== 'ECONNRESET') throw e;
        progress.log(`  Received ECONNRESET, will retry after ${backoff}ms.`);
        await new Promise(f => setTimeout(f, backoff));
        backoff *= 2;
      }
    }
    throw new Error('Unreachable');
  }
  async _sendRequest(progress, url, options, postData) {
    var _getHeader;
    await this._updateRequestCookieHeader(url, options.headers);
    const requestCookies = ((_getHeader = getHeader(options.headers, 'cookie')) === null || _getHeader === void 0 ? void 0 : _getHeader.split(';').map(p => {
      const [name, value] = p.split('=').map(v => v.trim());
      return {
        name,
        value
      };
    })) || [];
    const requestEvent = {
      url,
      method: options.method,
      headers: options.headers,
      cookies: requestCookies,
      postData
    };
    this.emit(APIRequestContext.Events.Request, requestEvent);
    return new Promise((fulfill, reject) => {
      const requestConstructor = (url.protocol === 'https:' ? _https.default : _http.default).request;
      // If we have a proxy agent already, do not override it.
      const agent = options.agent || (url.protocol === 'https:' ? _happyEyeballs.httpsHappyEyeballsAgent : _happyEyeballs.httpHappyEyeballsAgent);
      const requestOptions = {
        ...options,
        agent
      };
      const startAt = (0, _utils.monotonicTime)();
      let reusedSocketAt;
      let dnsLookupAt;
      let tcpConnectionAt;
      let tlsHandshakeAt;
      let requestFinishAt;
      let serverIPAddress;
      let serverPort;
      let securityDetails;
      const listeners = [];
      const request = requestConstructor(url, requestOptions, async response => {
        const responseAt = (0, _utils.monotonicTime)();
        const notifyRequestFinished = body => {
          const endAt = (0, _utils.monotonicTime)();
          // spec: http://www.softwareishard.com/blog/har-12-spec/#timings
          const connectEnd = tlsHandshakeAt !== null && tlsHandshakeAt !== void 0 ? tlsHandshakeAt : tcpConnectionAt;
          const timings = {
            send: requestFinishAt - startAt,
            wait: responseAt - requestFinishAt,
            receive: endAt - responseAt,
            dns: dnsLookupAt ? dnsLookupAt - startAt : -1,
            connect: connectEnd ? connectEnd - startAt : -1,
            // "If [ssl] is defined then the time is also included in the connect field "
            ssl: tlsHandshakeAt ? tlsHandshakeAt - tcpConnectionAt : -1,
            blocked: reusedSocketAt ? reusedSocketAt - startAt : -1
          };
          const requestFinishedEvent = {
            requestEvent,
            httpVersion: response.httpVersion,
            statusCode: response.statusCode || 0,
            statusMessage: response.statusMessage || '',
            headers: response.headers,
            rawHeaders: response.rawHeaders,
            cookies,
            body,
            timings,
            serverIPAddress,
            serverPort,
            securityDetails
          };
          this.emit(APIRequestContext.Events.RequestFinished, requestFinishedEvent);
        };
        progress.log(`← ${response.statusCode} ${response.statusMessage}`);
        for (const [name, value] of Object.entries(response.headers)) progress.log(`  ${name}: ${value}`);
        const cookies = this._parseSetCookieHeader(response.url || url.toString(), response.headers['set-cookie']);
        if (cookies.length) {
          try {
            await this._addCookies(cookies);
          } catch (e) {
            // Cookie value is limited by 4096 characters in the browsers. If setCookies failed,
            // we try setting each cookie individually just in case only some of them are bad.
            await Promise.all(cookies.map(c => this._addCookies([c]).catch(() => {})));
          }
        }
        if (redirectStatus.includes(response.statusCode) && options.maxRedirects >= 0) {
          var _response$headers$loc;
          if (!options.maxRedirects) {
            reject(new Error('Max redirect count exceeded'));
            request.destroy();
            return;
          }
          const headers = {
            ...options.headers
          };
          removeHeader(headers, `cookie`);

          // HTTP-redirect fetch step 13 (https://fetch.spec.whatwg.org/#http-redirect-fetch)
          const status = response.statusCode;
          let method = options.method;
          if ((status === 301 || status === 302) && method === 'POST' || status === 303 && !['GET', 'HEAD'].includes(method)) {
            method = 'GET';
            postData = undefined;
            removeHeader(headers, `content-encoding`);
            removeHeader(headers, `content-language`);
            removeHeader(headers, `content-length`);
            removeHeader(headers, `content-location`);
            removeHeader(headers, `content-type`);
          }
          const redirectOptions = {
            method,
            headers,
            agent: options.agent,
            maxRedirects: options.maxRedirects - 1,
            timeout: options.timeout,
            deadline: options.deadline,
            ...(0, _socksClientCertificatesInterceptor.getMatchingTLSOptionsForOrigin)(this._defaultOptions().clientCertificates, url.origin),
            __testHookLookup: options.__testHookLookup
          };
          // rejectUnauthorized = undefined is treated as true in node 12.
          if (options.rejectUnauthorized === false) redirectOptions.rejectUnauthorized = false;

          // HTTP-redirect fetch step 4: If locationURL is null, then return response.
          // Best-effort UTF-8 decoding, per spec it's US-ASCII only, but browsers are more lenient.
          // Node.js parses it as Latin1 via std::v8::String, so we convert it to UTF-8.
          const locationHeaderValue = Buffer.from((_response$headers$loc = response.headers.location) !== null && _response$headers$loc !== void 0 ? _response$headers$loc : '', 'latin1').toString('utf8');
          if (locationHeaderValue) {
            let locationURL;
            try {
              locationURL = new URL(locationHeaderValue, url);
            } catch (error) {
              reject(new Error(`uri requested responds with an invalid redirect URL: ${locationHeaderValue}`));
              request.destroy();
              return;
            }
            if (headers['host']) headers['host'] = locationURL.host;
            notifyRequestFinished();
            fulfill(this._sendRequest(progress, locationURL, redirectOptions, postData));
            request.destroy();
            return;
          }
        }
        if (response.statusCode === 401 && !getHeader(options.headers, 'authorization')) {
          const auth = response.headers['www-authenticate'];
          const credentials = this._getHttpCredentials(url);
          if (auth !== null && auth !== void 0 && auth.trim().startsWith('Basic') && credentials) {
            setBasicAuthorizationHeader(options.headers, credentials);
            notifyRequestFinished();
            fulfill(this._sendRequest(progress, url, options, postData));
            request.destroy();
            return;
          }
        }
        response.on('aborted', () => reject(new Error('aborted')));
        const chunks = [];
        const notifyBodyFinished = () => {
          const body = Buffer.concat(chunks);
          notifyRequestFinished(body);
          fulfill({
            url: response.url || url.toString(),
            status: response.statusCode || 0,
            statusText: response.statusMessage || '',
            headers: toHeadersArray(response.rawHeaders),
            body
          });
        };
        let body = response;
        let transform;
        const encoding = response.headers['content-encoding'];
        if (encoding === 'gzip' || encoding === 'x-gzip') {
          transform = zlib.createGunzip({
            flush: zlib.constants.Z_SYNC_FLUSH,
            finishFlush: zlib.constants.Z_SYNC_FLUSH
          });
        } else if (encoding === 'br') {
          transform = zlib.createBrotliDecompress({
            flush: zlib.constants.BROTLI_OPERATION_FLUSH,
            finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH
          });
        } else if (encoding === 'deflate') {
          transform = zlib.createInflate();
        }
        if (transform) {
          // Brotli and deflate decompressors throw if the input stream is empty.
          const emptyStreamTransform = new SafeEmptyStreamTransform(notifyBodyFinished);
          body = (0, _stream.pipeline)(response, emptyStreamTransform, transform, e => {
            if (e) reject(new Error(`failed to decompress '${encoding}' encoding: ${e.message}`));
          });
          body.on('error', e => reject(new Error(`failed to decompress '${encoding}' encoding: ${e}`)));
        } else {
          body.on('error', reject);
        }
        body.on('data', chunk => chunks.push(chunk));
        body.on('end', notifyBodyFinished);
      });
      request.on('error', reject);
      listeners.push(_utils.eventsHelper.addEventListener(this, APIRequestContext.Events.Dispose, () => {
        reject(new Error('Request context disposed.'));
        request.destroy();
      }));
      request.on('close', () => _utils.eventsHelper.removeEventListeners(listeners));
      request.on('socket', socket => {
        if (request.reusedSocket) {
          reusedSocketAt = (0, _utils.monotonicTime)();
          return;
        }

        // happy eyeballs don't emit lookup and connect events, so we use our custom ones
        const happyEyeBallsTimings = (0, _happyEyeballs.timingForSocket)(socket);
        dnsLookupAt = happyEyeBallsTimings.dnsLookupAt;
        tcpConnectionAt = happyEyeBallsTimings.tcpConnectionAt;

        // non-happy-eyeballs sockets
        listeners.push(_utils.eventsHelper.addEventListener(socket, 'lookup', () => {
          dnsLookupAt = (0, _utils.monotonicTime)();
        }), _utils.eventsHelper.addEventListener(socket, 'connect', () => {
          tcpConnectionAt = (0, _utils.monotonicTime)();
        }), _utils.eventsHelper.addEventListener(socket, 'secureConnect', () => {
          tlsHandshakeAt = (0, _utils.monotonicTime)();
          if (socket instanceof _tls.TLSSocket) {
            var _socket$getProtocol;
            const peerCertificate = socket.getPeerCertificate();
            securityDetails = {
              protocol: (_socket$getProtocol = socket.getProtocol()) !== null && _socket$getProtocol !== void 0 ? _socket$getProtocol : undefined,
              subjectName: peerCertificate.subject.CN,
              validFrom: new Date(peerCertificate.valid_from).getTime() / 1000,
              validTo: new Date(peerCertificate.valid_to).getTime() / 1000,
              issuer: peerCertificate.issuer.CN
            };
          }
        }));
        serverIPAddress = socket.remoteAddress;
        serverPort = socket.remotePort;
      });
      request.on('finish', () => {
        requestFinishAt = (0, _utils.monotonicTime)();
      });
      progress.log(`→ ${options.method} ${url.toString()}`);
      if (options.headers) {
        for (const [name, value] of Object.entries(options.headers)) progress.log(`  ${name}: ${value}`);
      }
      if (options.deadline) {
        const rejectOnTimeout = () => {
          reject(new Error(`Request timed out after ${options.timeout}ms`));
          request.destroy();
        };
        const remaining = options.deadline - (0, _utils.monotonicTime)();
        if (remaining <= 0) {
          rejectOnTimeout();
          return;
        }
        request.setTimeout(remaining, rejectOnTimeout);
      }
      if (postData) request.write(postData);
      request.end();
    });
  }
  _getHttpCredentials(url) {
    var _this$_defaultOptions, _this$_defaultOptions2;
    if (!((_this$_defaultOptions = this._defaultOptions().httpCredentials) !== null && _this$_defaultOptions !== void 0 && _this$_defaultOptions.origin) || url.origin.toLowerCase() === ((_this$_defaultOptions2 = this._defaultOptions().httpCredentials) === null || _this$_defaultOptions2 === void 0 || (_this$_defaultOptions2 = _this$_defaultOptions2.origin) === null || _this$_defaultOptions2 === void 0 ? void 0 : _this$_defaultOptions2.toLowerCase())) return this._defaultOptions().httpCredentials;
    return undefined;
  }
}
exports.APIRequestContext = APIRequestContext;
APIRequestContext.Events = {
  Dispose: 'dispose',
  Request: 'request',
  RequestFinished: 'requestfinished'
};
APIRequestContext.allInstances = new Set();
class SafeEmptyStreamTransform extends _stream.Transform {
  constructor(onEmptyStreamCallback) {
    super();
    this._receivedSomeData = false;
    this._onEmptyStreamCallback = void 0;
    this._onEmptyStreamCallback = onEmptyStreamCallback;
  }
  _transform(chunk, encoding, callback) {
    this._receivedSomeData = true;
    callback(null, chunk);
  }
  _flush(callback) {
    if (this._receivedSomeData) callback(null);else this._onEmptyStreamCallback();
  }
}
class BrowserContextAPIRequestContext extends APIRequestContext {
  constructor(context) {
    super(context);
    this._context = void 0;
    this._context = context;
    context.once(_browserContext.BrowserContext.Events.Close, () => this._disposeImpl());
  }
  tracing() {
    return this._context.tracing;
  }
  async dispose(options) {
    this._closeReason = options.reason;
    this.fetchResponses.clear();
  }
  _defaultOptions() {
    return {
      userAgent: this._context._options.userAgent || this._context._browser.userAgent(),
      extraHTTPHeaders: this._context._options.extraHTTPHeaders,
      failOnStatusCode: undefined,
      httpCredentials: this._context._options.httpCredentials,
      proxy: this._context._options.proxy || this._context._browser.options.proxy,
      timeoutSettings: this._context._timeoutSettings,
      ignoreHTTPSErrors: this._context._options.ignoreHTTPSErrors,
      baseURL: this._context._options.baseURL,
      clientCertificates: this._context._options.clientCertificates
    };
  }
  async _addCookies(cookies) {
    await this._context.addCookies(cookies);
  }
  async _cookies(url) {
    return await this._context.cookies(url.toString());
  }
  async storageState(indexedDB) {
    return this._context.storageState(indexedDB);
  }
}
exports.BrowserContextAPIRequestContext = BrowserContextAPIRequestContext;
class GlobalAPIRequestContext extends APIRequestContext {
  constructor(playwright, options) {
    super(playwright);
    this._cookieStore = new _cookieStore.CookieStore();
    this._options = void 0;
    this._origins = void 0;
    this._tracing = void 0;
    this.attribution.context = this;
    const timeoutSettings = new _timeoutSettings.TimeoutSettings();
    if (options.timeout !== undefined) timeoutSettings.setDefaultTimeout(options.timeout);
    const proxy = options.proxy;
    if (proxy !== null && proxy !== void 0 && proxy.server) {
      let url = proxy === null || proxy === void 0 ? void 0 : proxy.server.trim();
      if (!/^\w+:\/\//.test(url)) url = 'http://' + url;
      proxy.server = url;
    }
    if (options.storageState) {
      var _options$storageState;
      this._origins = (_options$storageState = options.storageState.origins) === null || _options$storageState === void 0 ? void 0 : _options$storageState.map(origin => ({
        indexedDB: [],
        ...origin
      }));
      this._cookieStore.addCookies(options.storageState.cookies || []);
    }
    (0, _browserContext.verifyClientCertificates)(options.clientCertificates);
    this._options = {
      baseURL: options.baseURL,
      userAgent: options.userAgent || (0, _userAgent.getUserAgent)(),
      extraHTTPHeaders: options.extraHTTPHeaders,
      failOnStatusCode: !!options.failOnStatusCode,
      ignoreHTTPSErrors: !!options.ignoreHTTPSErrors,
      httpCredentials: options.httpCredentials,
      clientCertificates: options.clientCertificates,
      proxy,
      timeoutSettings
    };
    this._tracing = new _tracing.Tracing(this, options.tracesDir);
  }
  tracing() {
    return this._tracing;
  }
  async dispose(options) {
    this._closeReason = options.reason;
    await this._tracing.flush();
    await this._tracing.deleteTmpTracesDir();
    this._disposeImpl();
  }
  _defaultOptions() {
    return this._options;
  }
  async _addCookies(cookies) {
    this._cookieStore.addCookies(cookies);
  }
  async _cookies(url) {
    return this._cookieStore.cookies(url);
  }
  async storageState(indexedDB = false) {
    return {
      cookies: this._cookieStore.allCookies(),
      origins: (this._origins || []).map(origin => ({
        ...origin,
        indexedDB: indexedDB ? origin.indexedDB : []
      }))
    };
  }
}
exports.GlobalAPIRequestContext = GlobalAPIRequestContext;
function createProxyAgent(proxy) {
  var _proxyOpts$protocol;
  const proxyOpts = _url.default.parse(proxy.server);
  if ((_proxyOpts$protocol = proxyOpts.protocol) !== null && _proxyOpts$protocol !== void 0 && _proxyOpts$protocol.startsWith('socks')) {
    return new _utilsBundle.SocksProxyAgent({
      host: proxyOpts.hostname,
      port: proxyOpts.port || undefined
    });
  }
  if (proxy.username) proxyOpts.auth = `${proxy.username}:${proxy.password || ''}`;
  // TODO: We should use HttpProxyAgent conditional on proxyOpts.protocol instead of always using CONNECT method.
  return new _utilsBundle.HttpsProxyAgent(proxyOpts);
}
function toHeadersArray(rawHeaders) {
  const result = [];
  for (let i = 0; i < rawHeaders.length; i += 2) result.push({
    name: rawHeaders[i],
    value: rawHeaders[i + 1]
  });
  return result;
}
const redirectStatus = [301, 302, 303, 307, 308];
function parseCookie(header) {
  const raw = (0, _cookieStore.parseRawCookie)(header);
  if (!raw) return null;
  const cookie = {
    domain: '',
    path: '',
    expires: -1,
    httpOnly: false,
    secure: false,
    // From https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite
    // The cookie-sending behavior if SameSite is not specified is SameSite=Lax.
    sameSite: 'Lax',
    ...raw
  };
  return cookie;
}
function serializePostData(params, headers) {
  (0, _utils.assert)((params.postData ? 1 : 0) + (params.jsonData ? 1 : 0) + (params.formData ? 1 : 0) + (params.multipartData ? 1 : 0) <= 1, `Only one of 'data', 'form' or 'multipart' can be specified`);
  if (params.jsonData !== undefined) {
    setHeader(headers, 'content-type', 'application/json', true);
    return Buffer.from(params.jsonData, 'utf8');
  } else if (params.formData) {
    const searchParams = new URLSearchParams();
    for (const {
      name,
      value
    } of params.formData) searchParams.append(name, value);
    setHeader(headers, 'content-type', 'application/x-www-form-urlencoded', true);
    return Buffer.from(searchParams.toString(), 'utf8');
  } else if (params.multipartData) {
    const formData = new _formData.MultipartFormData();
    for (const field of params.multipartData) {
      if (field.file) formData.addFileField(field.name, field.file);else if (field.value) formData.addField(field.name, field.value);
    }
    setHeader(headers, 'content-type', formData.contentTypeHeader(), true);
    return formData.finish();
  } else if (params.postData !== undefined) {
    setHeader(headers, 'content-type', 'application/octet-stream', true);
    return params.postData;
  }
  return undefined;
}
function setHeader(headers, name, value, keepExisting = false) {
  const existing = Object.entries(headers).find(pair => pair[0].toLowerCase() === name.toLowerCase());
  if (!existing) headers[name] = value;else if (!keepExisting) headers[existing[0]] = value;
}
function getHeader(headers, name) {
  const existing = Object.entries(headers).find(pair => pair[0].toLowerCase() === name.toLowerCase());
  return existing ? existing[1] : undefined;
}
function removeHeader(headers, name) {
  delete headers[name];
}
function shouldBypassProxy(url, bypass) {
  if (!bypass) return false;
  const domains = bypass.split(',').map(s => {
    s = s.trim();
    if (!s.startsWith('.')) s = '.' + s;
    return s;
  });
  const domain = '.' + url.hostname;
  return domains.some(d => domain.endsWith(d));
}
function setBasicAuthorizationHeader(headers, credentials) {
  const {
    username,
    password
  } = credentials;
  const encoded = Buffer.from(`${username || ''}:${password || ''}`).toString('base64');
  setHeader(headers, 'authorization', `Basic ${encoded}`);
}