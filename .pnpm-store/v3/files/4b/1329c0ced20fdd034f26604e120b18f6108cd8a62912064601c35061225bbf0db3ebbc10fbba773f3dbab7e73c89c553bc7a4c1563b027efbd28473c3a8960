"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.APIResponse = exports.APIRequestContext = exports.APIRequest = void 0;
var _browserContext = require("./browserContext");
var _channelOwner = require("./channelOwner");
var _errors = require("./errors");
var _network = require("./network");
var _tracing = require("./tracing");
var _assert = require("../utils/isomorphic/assert");
var _fileUtils = require("./fileUtils");
var _headers = require("../utils/isomorphic/headers");
var _rtti = require("../utils/isomorphic/rtti");
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

class APIRequest {
  constructor(playwright) {
    this._playwright = void 0;
    this._contexts = new Set();
    this._playwright = playwright;
  }
  async newContext(options = {}) {
    var _this$_playwright$_de, _this$_playwright$_de2;
    options = {
      ...this._playwright._defaultContextOptions,
      timeout: this._playwright._defaultContextTimeout,
      ...options
    };
    const storageState = typeof options.storageState === 'string' ? JSON.parse(await this._playwright._platform.fs().promises.readFile(options.storageState, 'utf8')) : options.storageState;
    const context = APIRequestContext.from((await this._playwright._channel.newRequest({
      ...options,
      extraHTTPHeaders: options.extraHTTPHeaders ? (0, _headers.headersObjectToArray)(options.extraHTTPHeaders) : undefined,
      storageState,
      tracesDir: (_this$_playwright$_de = this._playwright._defaultLaunchOptions) === null || _this$_playwright$_de === void 0 ? void 0 : _this$_playwright$_de.tracesDir,
      // We do not expose tracesDir in the API, so do not allow options to accidentally override it.
      clientCertificates: await (0, _browserContext.toClientCertificatesProtocol)(this._playwright._platform, options.clientCertificates)
    })).request);
    this._contexts.add(context);
    context._request = this;
    context._tracing._tracesDir = (_this$_playwright$_de2 = this._playwright._defaultLaunchOptions) === null || _this$_playwright$_de2 === void 0 ? void 0 : _this$_playwright$_de2.tracesDir;
    await context._instrumentation.runAfterCreateRequestContext(context);
    return context;
  }
}
exports.APIRequest = APIRequest;
class APIRequestContext extends _channelOwner.ChannelOwner {
  static from(channel) {
    return channel._object;
  }
  constructor(parent, type, guid, initializer) {
    super(parent, type, guid, initializer);
    this._request = void 0;
    this._tracing = void 0;
    this._closeReason = void 0;
    this._tracing = _tracing.Tracing.from(initializer.tracing);
  }
  async [Symbol.asyncDispose]() {
    await this.dispose();
  }
  async dispose(options = {}) {
    var _this$_request;
    this._closeReason = options.reason;
    await this._instrumentation.runBeforeCloseRequestContext(this);
    try {
      await this._channel.dispose(options);
    } catch (e) {
      if ((0, _errors.isTargetClosedError)(e)) return;
      throw e;
    }
    this._tracing._resetStackCounter();
    (_this$_request = this._request) === null || _this$_request === void 0 || _this$_request._contexts.delete(this);
  }
  async delete(url, options) {
    return await this.fetch(url, {
      ...options,
      method: 'DELETE'
    });
  }
  async head(url, options) {
    return await this.fetch(url, {
      ...options,
      method: 'HEAD'
    });
  }
  async get(url, options) {
    return await this.fetch(url, {
      ...options,
      method: 'GET'
    });
  }
  async patch(url, options) {
    return await this.fetch(url, {
      ...options,
      method: 'PATCH'
    });
  }
  async post(url, options) {
    return await this.fetch(url, {
      ...options,
      method: 'POST'
    });
  }
  async put(url, options) {
    return await this.fetch(url, {
      ...options,
      method: 'PUT'
    });
  }
  async fetch(urlOrRequest, options = {}) {
    const url = (0, _rtti.isString)(urlOrRequest) ? urlOrRequest : undefined;
    const request = (0, _rtti.isString)(urlOrRequest) ? undefined : urlOrRequest;
    return await this._innerFetch({
      url,
      request,
      ...options
    });
  }
  async _innerFetch(options = {}) {
    return await this._wrapApiCall(async () => {
      var _options$request, _options$request2, _options$request3;
      if (this._closeReason) throw new _errors.TargetClosedError(this._closeReason);
      (0, _assert.assert)(options.request || typeof options.url === 'string', 'First argument must be either URL string or Request');
      (0, _assert.assert)((options.data === undefined ? 0 : 1) + (options.form === undefined ? 0 : 1) + (options.multipart === undefined ? 0 : 1) <= 1, `Only one of 'data', 'form' or 'multipart' can be specified`);
      (0, _assert.assert)(options.maxRedirects === undefined || options.maxRedirects >= 0, `'maxRedirects' must be greater than or equal to '0'`);
      (0, _assert.assert)(options.maxRetries === undefined || options.maxRetries >= 0, `'maxRetries' must be greater than or equal to '0'`);
      const url = options.url !== undefined ? options.url : options.request.url();
      const method = options.method || ((_options$request = options.request) === null || _options$request === void 0 ? void 0 : _options$request.method());
      let encodedParams = undefined;
      if (typeof options.params === 'string') encodedParams = options.params;else if (options.params instanceof URLSearchParams) encodedParams = options.params.toString();
      // Cannot call allHeaders() here as the request may be paused inside route handler.
      const headersObj = options.headers || ((_options$request2 = options.request) === null || _options$request2 === void 0 ? void 0 : _options$request2.headers());
      const headers = headersObj ? (0, _headers.headersObjectToArray)(headersObj) : undefined;
      let jsonData;
      let formData;
      let multipartData;
      let postDataBuffer;
      if (options.data !== undefined) {
        if ((0, _rtti.isString)(options.data)) {
          if (isJsonContentType(headers)) jsonData = isJsonParsable(options.data) ? options.data : JSON.stringify(options.data);else postDataBuffer = Buffer.from(options.data, 'utf8');
        } else if (Buffer.isBuffer(options.data)) {
          postDataBuffer = options.data;
        } else if (typeof options.data === 'object' || typeof options.data === 'number' || typeof options.data === 'boolean') {
          jsonData = JSON.stringify(options.data);
        } else {
          throw new Error(`Unexpected 'data' type`);
        }
      } else if (options.form) {
        if (globalThis.FormData && options.form instanceof FormData) {
          formData = [];
          for (const [name, value] of options.form.entries()) {
            if (typeof value !== 'string') throw new Error(`Expected string for options.form["${name}"], found File. Please use options.multipart instead.`);
            formData.push({
              name,
              value
            });
          }
        } else {
          formData = objectToArray(options.form);
        }
      } else if (options.multipart) {
        multipartData = [];
        if (globalThis.FormData && options.multipart instanceof FormData) {
          const form = options.multipart;
          for (const [name, value] of form.entries()) {
            if ((0, _rtti.isString)(value)) {
              multipartData.push({
                name,
                value
              });
            } else {
              const file = {
                name: value.name,
                mimeType: value.type,
                buffer: Buffer.from(await value.arrayBuffer())
              };
              multipartData.push({
                name,
                file
              });
            }
          }
        } else {
          // Convert file-like values to ServerFilePayload structs.
          for (const [name, value] of Object.entries(options.multipart)) multipartData.push(await toFormField(this._platform, name, value));
        }
      }
      if (postDataBuffer === undefined && jsonData === undefined && formData === undefined && multipartData === undefined) postDataBuffer = ((_options$request3 = options.request) === null || _options$request3 === void 0 ? void 0 : _options$request3.postDataBuffer()) || undefined;
      const fixtures = {
        __testHookLookup: options.__testHookLookup
      };
      const result = await this._channel.fetch({
        url,
        params: typeof options.params === 'object' ? objectToArray(options.params) : undefined,
        encodedParams,
        method,
        headers,
        postData: postDataBuffer,
        jsonData,
        formData,
        multipartData,
        timeout: options.timeout,
        failOnStatusCode: options.failOnStatusCode,
        ignoreHTTPSErrors: options.ignoreHTTPSErrors,
        maxRedirects: options.maxRedirects,
        maxRetries: options.maxRetries,
        ...fixtures
      });
      return new APIResponse(this, result.response);
    });
  }
  async storageState(options = {}) {
    const state = await this._channel.storageState({
      indexedDB: options.indexedDB
    });
    if (options.path) {
      await (0, _fileUtils.mkdirIfNeeded)(this._platform, options.path);
      await this._platform.fs().promises.writeFile(options.path, JSON.stringify(state, undefined, 2), 'utf8');
    }
    return state;
  }
}
exports.APIRequestContext = APIRequestContext;
async function toFormField(platform, name, value) {
  const typeOfValue = typeof value;
  if (isFilePayload(value)) {
    const payload = value;
    if (!Buffer.isBuffer(payload.buffer)) throw new Error(`Unexpected buffer type of 'data.${name}'`);
    return {
      name,
      file: filePayloadToJson(payload)
    };
  } else if (typeOfValue === 'string' || typeOfValue === 'number' || typeOfValue === 'boolean') {
    return {
      name,
      value: String(value)
    };
  } else {
    return {
      name,
      file: await readStreamToJson(platform, value)
    };
  }
}
function isJsonParsable(value) {
  if (typeof value !== 'string') return false;
  try {
    JSON.parse(value);
    return true;
  } catch (e) {
    if (e instanceof SyntaxError) return false;else throw e;
  }
}
class APIResponse {
  constructor(context, initializer) {
    this._initializer = void 0;
    this._headers = void 0;
    this._request = void 0;
    this._request = context;
    this._initializer = initializer;
    this._headers = new _network.RawHeaders(this._initializer.headers);
    if (context._platform.inspectCustom) this[context._platform.inspectCustom] = () => this._inspect();
  }
  ok() {
    return this._initializer.status >= 200 && this._initializer.status <= 299;
  }
  url() {
    return this._initializer.url;
  }
  status() {
    return this._initializer.status;
  }
  statusText() {
    return this._initializer.statusText;
  }
  headers() {
    return this._headers.headers();
  }
  headersArray() {
    return this._headers.headersArray();
  }
  async body() {
    return await this._request._wrapApiCall(async () => {
      try {
        const result = await this._request._channel.fetchResponseBody({
          fetchUid: this._fetchUid()
        });
        if (result.binary === undefined) throw new Error('Response has been disposed');
        return result.binary;
      } catch (e) {
        if ((0, _errors.isTargetClosedError)(e)) throw new Error('Response has been disposed');
        throw e;
      }
    }, true);
  }
  async text() {
    const content = await this.body();
    return content.toString('utf8');
  }
  async json() {
    const content = await this.text();
    return JSON.parse(content);
  }
  async [Symbol.asyncDispose]() {
    await this.dispose();
  }
  async dispose() {
    await this._request._channel.disposeAPIResponse({
      fetchUid: this._fetchUid()
    });
  }
  _inspect() {
    const headers = this.headersArray().map(({
      name,
      value
    }) => `  ${name}: ${value}`);
    return `APIResponse: ${this.status()} ${this.statusText()}\n${headers.join('\n')}`;
  }
  _fetchUid() {
    return this._initializer.fetchUid;
  }
  async _fetchLog() {
    const {
      log
    } = await this._request._channel.fetchLog({
      fetchUid: this._fetchUid()
    });
    return log;
  }
}
exports.APIResponse = APIResponse;
function filePayloadToJson(payload) {
  return {
    name: payload.name,
    mimeType: payload.mimeType,
    buffer: payload.buffer
  };
}
async function readStreamToJson(platform, stream) {
  const buffer = await new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', err => reject(err));
  });
  const streamPath = Buffer.isBuffer(stream.path) ? stream.path.toString('utf8') : stream.path;
  return {
    name: platform.path().basename(streamPath),
    buffer
  };
}
function isJsonContentType(headers) {
  if (!headers) return false;
  for (const {
    name,
    value
  } of headers) {
    if (name.toLocaleLowerCase() === 'content-type') return value === 'application/json';
  }
  return false;
}
function objectToArray(map) {
  if (!map) return undefined;
  const result = [];
  for (const [name, value] of Object.entries(map)) {
    if (value !== undefined) result.push({
      name,
      value: String(value)
    });
  }
  return result;
}
function isFilePayload(value) {
  return typeof value === 'object' && value['name'] && value['mimeType'] && value['buffer'];
}