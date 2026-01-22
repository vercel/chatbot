"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.kBrowserCloseMessageId = exports.BidiSession = exports.BidiConnection = void 0;
var _events = require("events");
var _debugLogger = require("../utils/debugLogger");
var _helper = require("../helper");
var _protocolError = require("../protocolError");
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

// BidiPlaywright uses this special id to issue Browser.close command which we
// should ignore.
const kBrowserCloseMessageId = exports.kBrowserCloseMessageId = 0;
class BidiConnection {
  constructor(transport, onDisconnect, protocolLogger, browserLogsCollector) {
    this._transport = void 0;
    this._onDisconnect = void 0;
    this._protocolLogger = void 0;
    this._browserLogsCollector = void 0;
    this._browserDisconnectedLogs = void 0;
    this._lastId = 0;
    this._closed = false;
    this.browserSession = void 0;
    this._browsingContextToSession = new Map();
    this._transport = transport;
    this._onDisconnect = onDisconnect;
    this._protocolLogger = protocolLogger;
    this._browserLogsCollector = browserLogsCollector;
    this.browserSession = new BidiSession(this, '', message => {
      this.rawSend(message);
    });
    this._transport.onmessage = this._dispatchMessage.bind(this);
    // onclose should be set last, since it can be immediately called.
    this._transport.onclose = this._onClose.bind(this);
  }
  nextMessageId() {
    return ++this._lastId;
  }
  rawSend(message) {
    this._protocolLogger('send', message);
    this._transport.send(message);
  }
  _dispatchMessage(message) {
    this._protocolLogger('receive', message);
    const object = message;
    // Bidi messages do not have a common session identifier, so we
    // route them based on BrowsingContext.
    if (object.type === 'event') {
      var _object$params$source;
      // Route page events to the right session.
      let context;
      if ('context' in object.params) context = object.params.context;else if (object.method === 'log.entryAdded' || object.method === 'script.message') context = (_object$params$source = object.params.source) === null || _object$params$source === void 0 ? void 0 : _object$params$source.context;
      if (context) {
        const session = this._browsingContextToSession.get(context);
        if (session) {
          session.dispatchMessage(message);
          return;
        }
      }
    } else if (message.id) {
      // Find caller session.
      for (const session of this._browsingContextToSession.values()) {
        if (session.hasCallback(message.id)) {
          session.dispatchMessage(message);
          return;
        }
      }
    }
    this.browserSession.dispatchMessage(message);
  }
  _onClose(reason) {
    this._closed = true;
    this._transport.onmessage = undefined;
    this._transport.onclose = undefined;
    this._browserDisconnectedLogs = _helper.helper.formatBrowserLogs(this._browserLogsCollector.recentLogs(), reason);
    this.browserSession.dispose();
    this._onDisconnect();
  }
  isClosed() {
    return this._closed;
  }
  close() {
    if (!this._closed) this._transport.close();
  }
  createMainFrameBrowsingContextSession(bowsingContextId) {
    const result = new BidiSession(this, bowsingContextId, message => this.rawSend(message));
    this._browsingContextToSession.set(bowsingContextId, result);
    return result;
  }
}
exports.BidiConnection = BidiConnection;
class BidiSession extends _events.EventEmitter {
  constructor(connection, sessionId, rawSend) {
    super();
    this.connection = void 0;
    this.sessionId = void 0;
    this._disposed = false;
    this._rawSend = void 0;
    this._callbacks = new Map();
    this._crashed = false;
    this._browsingContexts = new Set();
    this.on = void 0;
    this.addListener = void 0;
    this.off = void 0;
    this.removeListener = void 0;
    this.once = void 0;
    this.setMaxListeners(0);
    this.connection = connection;
    this.sessionId = sessionId;
    this._rawSend = rawSend;
    this.on = super.on;
    this.off = super.removeListener;
    this.addListener = super.addListener;
    this.removeListener = super.removeListener;
    this.once = super.once;
  }
  addFrameBrowsingContext(context) {
    this._browsingContexts.add(context);
    this.connection._browsingContextToSession.set(context, this);
  }
  removeFrameBrowsingContext(context) {
    this._browsingContexts.delete(context);
    this.connection._browsingContextToSession.delete(context);
  }
  async send(method, params) {
    if (this._crashed || this._disposed || this.connection._browserDisconnectedLogs) throw new _protocolError.ProtocolError(this._crashed ? 'crashed' : 'closed', undefined, this.connection._browserDisconnectedLogs);
    const id = this.connection.nextMessageId();
    const messageObj = {
      id,
      method,
      params
    };
    this._rawSend(messageObj);
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, {
        resolve,
        reject,
        error: new _protocolError.ProtocolError('error', method)
      });
    });
  }
  sendMayFail(method, params) {
    return this.send(method, params).catch(error => _debugLogger.debugLogger.log('error', error));
  }
  markAsCrashed() {
    this._crashed = true;
  }
  isDisposed() {
    return this._disposed;
  }
  dispose() {
    this._disposed = true;
    this.connection._browsingContextToSession.delete(this.sessionId);
    for (const context of this._browsingContexts) this.connection._browsingContextToSession.delete(context);
    this._browsingContexts.clear();
    for (const callback of this._callbacks.values()) {
      callback.error.type = this._crashed ? 'crashed' : 'closed';
      callback.error.logs = this.connection._browserDisconnectedLogs;
      callback.reject(callback.error);
    }
    this._callbacks.clear();
  }
  hasCallback(id) {
    return this._callbacks.has(id);
  }
  dispatchMessage(message) {
    const object = message;
    if (object.id === kBrowserCloseMessageId) return;
    if (object.id && this._callbacks.has(object.id)) {
      const callback = this._callbacks.get(object.id);
      this._callbacks.delete(object.id);
      if (object.type === 'error') {
        callback.error.setMessage(object.error + '\nMessage: ' + object.message);
        callback.reject(callback.error);
      } else if (object.type === 'success') {
        callback.resolve(object.result);
      } else {
        callback.error.setMessage('Internal error, unexpected response type: ' + JSON.stringify(object));
        callback.reject(callback.error);
      }
    } else if (object.id) {
      // Response might come after session has been disposed and rejected all callbacks.
    } else {
      Promise.resolve().then(() => this.emit(object.method, object.params));
    }
  }
}
exports.BidiSession = BidiSession;