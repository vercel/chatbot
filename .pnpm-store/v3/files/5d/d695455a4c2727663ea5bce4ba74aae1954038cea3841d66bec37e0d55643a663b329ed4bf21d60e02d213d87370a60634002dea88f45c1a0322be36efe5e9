"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ChannelOwner = void 0;
var _eventEmitter = require("./eventEmitter");
var _validator = require("../protocol/validator");
var _clientStackTrace = require("./clientStackTrace");
var _stackTrace = require("../utils/isomorphic/stackTrace");
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

class ChannelOwner extends _eventEmitter.EventEmitter {
  constructor(parent, type, guid, initializer) {
    const connection = parent instanceof ChannelOwner ? parent._connection : parent;
    super(connection._platform);
    this._connection = void 0;
    this._parent = void 0;
    this._objects = new Map();
    this._type = void 0;
    this._guid = void 0;
    this._channel = void 0;
    this._initializer = void 0;
    this._logger = void 0;
    this._instrumentation = void 0;
    this._eventToSubscriptionMapping = new Map();
    this._isInternalType = false;
    this._wasCollected = false;
    this.setMaxListeners(0);
    this._connection = connection;
    this._type = type;
    this._guid = guid;
    this._parent = parent instanceof ChannelOwner ? parent : undefined;
    this._instrumentation = this._connection._instrumentation;
    this._connection._objects.set(guid, this);
    if (this._parent) {
      this._parent._objects.set(guid, this);
      this._logger = this._parent._logger;
    }
    this._channel = this._createChannel(new _eventEmitter.EventEmitter(connection._platform));
    this._initializer = initializer;
  }
  markAsInternalType() {
    this._isInternalType = true;
  }
  _setEventToSubscriptionMapping(mapping) {
    this._eventToSubscriptionMapping = mapping;
  }
  _updateSubscription(event, enabled) {
    const protocolEvent = this._eventToSubscriptionMapping.get(String(event));
    if (protocolEvent) {
      this._wrapApiCall(async () => {
        await this._channel.updateSubscription({
          event: protocolEvent,
          enabled
        });
      }, true).catch(() => {});
    }
  }
  on(event, listener) {
    if (!this.listenerCount(event)) this._updateSubscription(event, true);
    super.on(event, listener);
    return this;
  }
  addListener(event, listener) {
    if (!this.listenerCount(event)) this._updateSubscription(event, true);
    super.addListener(event, listener);
    return this;
  }
  prependListener(event, listener) {
    if (!this.listenerCount(event)) this._updateSubscription(event, true);
    super.prependListener(event, listener);
    return this;
  }
  off(event, listener) {
    super.off(event, listener);
    if (!this.listenerCount(event)) this._updateSubscription(event, false);
    return this;
  }
  removeListener(event, listener) {
    super.removeListener(event, listener);
    if (!this.listenerCount(event)) this._updateSubscription(event, false);
    return this;
  }
  _adopt(child) {
    child._parent._objects.delete(child._guid);
    this._objects.set(child._guid, child);
    child._parent = this;
  }
  _dispose(reason) {
    // Clean up from parent and connection.
    if (this._parent) this._parent._objects.delete(this._guid);
    this._connection._objects.delete(this._guid);
    this._wasCollected = reason === 'gc';

    // Dispose all children.
    for (const object of [...this._objects.values()]) object._dispose(reason);
    this._objects.clear();
  }
  _debugScopeState() {
    return {
      _guid: this._guid,
      objects: Array.from(this._objects.values()).map(o => o._debugScopeState())
    };
  }
  _validatorToWireContext() {
    return {
      tChannelImpl: tChannelImplToWire,
      binary: this._connection.rawBuffers() ? 'buffer' : 'toBase64',
      isUnderTest: () => this._platform.isUnderTest()
    };
  }
  _createChannel(base) {
    const channel = new Proxy(base, {
      get: (obj, prop) => {
        if (typeof prop === 'string') {
          const validator = (0, _validator.maybeFindValidator)(this._type, prop, 'Params');
          if (validator) {
            return async params => {
              return await this._wrapApiCall(async apiZone => {
                const validatedParams = validator(params, '', this._validatorToWireContext());
                if (!apiZone.isInternal && !apiZone.reported) {
                  // Reporting/tracing/logging this api call for the first time.
                  apiZone.params = params;
                  apiZone.reported = true;
                  this._instrumentation.onApiCallBegin(apiZone);
                  logApiCall(this._platform, this._logger, `=> ${apiZone.apiName} started`);
                  return await this._connection.sendMessageToServer(this, prop, validatedParams, apiZone.apiName, apiZone.frames, apiZone.stepId);
                }
                // Since this api call is either internal, or has already been reported/traced once,
                // passing undefined apiName will avoid an extra unneeded tracing entry.
                return await this._connection.sendMessageToServer(this, prop, validatedParams, undefined, [], undefined);
              });
            };
          }
        }
        return obj[prop];
      }
    });
    channel._object = this;
    return channel;
  }
  async _wrapApiCall(func, isInternal) {
    const logger = this._logger;
    const existingApiZone = this._platform.zones.current().data();
    if (existingApiZone) return await func(existingApiZone);
    if (isInternal === undefined) isInternal = this._isInternalType;
    const stackTrace = (0, _clientStackTrace.captureLibraryStackTrace)(this._platform);
    const apiZone = {
      apiName: stackTrace.apiName,
      frames: stackTrace.frames,
      isInternal,
      reported: false,
      userData: undefined,
      stepId: undefined
    };
    try {
      const result = await this._platform.zones.current().push(apiZone).run(async () => await func(apiZone));
      if (!isInternal) {
        logApiCall(this._platform, logger, `<= ${apiZone.apiName} succeeded`);
        this._instrumentation.onApiCallEnd(apiZone);
      }
      return result;
    } catch (e) {
      const innerError = (this._platform.showInternalStackFrames() || this._platform.isUnderTest()) && e.stack ? '\n<inner error>\n' + e.stack : '';
      if (apiZone.apiName && !apiZone.apiName.includes('<anonymous>')) e.message = apiZone.apiName + ': ' + e.message;
      const stackFrames = '\n' + (0, _stackTrace.stringifyStackFrames)(stackTrace.frames).join('\n') + innerError;
      if (stackFrames.trim()) e.stack = e.message + stackFrames;else e.stack = '';
      if (!isInternal) {
        apiZone.error = e;
        logApiCall(this._platform, logger, `<= ${apiZone.apiName} failed`);
        this._instrumentation.onApiCallEnd(apiZone);
      }
      throw e;
    }
  }
  _toImpl() {
    var _this$_connection$toI, _this$_connection;
    return (_this$_connection$toI = (_this$_connection = this._connection).toImpl) === null || _this$_connection$toI === void 0 ? void 0 : _this$_connection$toI.call(_this$_connection, this);
  }
  toJSON() {
    // Jest's expect library tries to print objects sometimes.
    // RPC objects can contain links to lots of other objects,
    // which can cause jest to crash. Let's help it out
    // by just returning the important values.
    return {
      _type: this._type,
      _guid: this._guid
    };
  }
}
exports.ChannelOwner = ChannelOwner;
function logApiCall(platform, logger, message) {
  if (logger && logger.isEnabled('api', 'info')) logger.log('api', 'info', message, [], {
    color: 'cyan'
  });
  platform.log('api', message);
}
function tChannelImplToWire(names, arg, path, context) {
  if (arg._object instanceof ChannelOwner && (names === '*' || names.includes(arg._object._type))) return {
    guid: arg._object._guid
  };
  throw new _validator.ValidationError(`${path}: expected channel ${names.toString()}`);
}