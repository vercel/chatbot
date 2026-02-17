"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.BidiExecutionContext = void 0;
exports.createHandle = createHandle;
var _utils = require("../../utils");
var _utilityScriptSerializers = require("../isomorphic/utilityScriptSerializers");
var js = _interopRequireWildcard(require("../javascript"));
var dom = _interopRequireWildcard(require("../dom"));
var _bidiDeserializer = require("./third_party/bidiDeserializer");
var bidi = _interopRequireWildcard(require("./third_party/bidiProtocol"));
var _bidiSerializer = require("./third_party/bidiSerializer");
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

class BidiExecutionContext {
  constructor(session, realmInfo) {
    this._session = void 0;
    this._target = void 0;
    this._session = session;
    if (realmInfo.type === 'window') {
      // Simple realm does not seem to work for Window contexts.
      this._target = {
        context: realmInfo.context,
        sandbox: realmInfo.sandbox
      };
    } else {
      this._target = {
        realm: realmInfo.realm
      };
    }
  }
  async rawEvaluateJSON(expression) {
    const response = await this._session.send('script.evaluate', {
      expression,
      target: this._target,
      serializationOptions: {
        maxObjectDepth: 10,
        maxDomDepth: 10
      },
      awaitPromise: true,
      userActivation: true
    });
    if (response.type === 'success') return _bidiDeserializer.BidiDeserializer.deserialize(response.result);
    if (response.type === 'exception') throw new js.JavaScriptErrorInEvaluate(response.exceptionDetails.text + '\nFull val: ' + JSON.stringify(response.exceptionDetails));
    throw new js.JavaScriptErrorInEvaluate('Unexpected response type: ' + JSON.stringify(response));
  }
  async rawEvaluateHandle(context, expression) {
    const response = await this._session.send('script.evaluate', {
      expression,
      target: this._target,
      resultOwnership: bidi.Script.ResultOwnership.Root,
      // Necessary for the handle to be returned.
      serializationOptions: {
        maxObjectDepth: 0,
        maxDomDepth: 0
      },
      awaitPromise: true,
      userActivation: true
    });
    if (response.type === 'success') {
      if ('handle' in response.result) return createHandle(context, response.result);
      throw new js.JavaScriptErrorInEvaluate('Cannot get handle: ' + JSON.stringify(response.result));
    }
    if (response.type === 'exception') throw new js.JavaScriptErrorInEvaluate(response.exceptionDetails.text + '\nFull val: ' + JSON.stringify(response.exceptionDetails));
    throw new js.JavaScriptErrorInEvaluate('Unexpected response type: ' + JSON.stringify(response));
  }
  async evaluateWithArguments(functionDeclaration, returnByValue, utilityScript, values, handles) {
    const response = await this._session.send('script.callFunction', {
      functionDeclaration,
      target: this._target,
      arguments: [{
        handle: utilityScript._objectId
      }, ...values.map(_bidiSerializer.BidiSerializer.serialize), ...handles.map(handle => ({
        handle: handle._objectId
      }))],
      resultOwnership: returnByValue ? undefined : bidi.Script.ResultOwnership.Root,
      // Necessary for the handle to be returned.
      serializationOptions: returnByValue ? {} : {
        maxObjectDepth: 0,
        maxDomDepth: 0
      },
      awaitPromise: true,
      userActivation: true
    });
    if (response.type === 'exception') throw new js.JavaScriptErrorInEvaluate(response.exceptionDetails.text + '\nFull val: ' + JSON.stringify(response.exceptionDetails));
    if (response.type === 'success') {
      if (returnByValue) return (0, _utilityScriptSerializers.parseEvaluationResultValue)(_bidiDeserializer.BidiDeserializer.deserialize(response.result));
      return createHandle(utilityScript._context, response.result);
    }
    throw new js.JavaScriptErrorInEvaluate('Unexpected response type: ' + JSON.stringify(response));
  }
  async getProperties(handle) {
    const names = await handle.evaluate(object => {
      const names = [];
      const descriptors = Object.getOwnPropertyDescriptors(object);
      for (const name in descriptors) {
        var _descriptors$name;
        if ((_descriptors$name = descriptors[name]) !== null && _descriptors$name !== void 0 && _descriptors$name.enumerable) names.push(name);
      }
      return names;
    });
    const values = await Promise.all(names.map(name => handle.evaluateHandle((object, name) => object[name], name)));
    const map = new Map();
    for (let i = 0; i < names.length; i++) map.set(names[i], values[i]);
    return map;
  }
  async releaseHandle(handle) {
    if (!handle._objectId) return;
    await this._session.send('script.disown', {
      target: this._target,
      handles: [handle._objectId]
    });
  }
  async nodeIdForElementHandle(handle) {
    const shared = await this._remoteValueForReference({
      handle: handle._objectId
    });
    // TODO: store sharedId in the handle.
    if (!('sharedId' in shared)) throw new Error('Element is not a node');
    return {
      sharedId: shared.sharedId
    };
  }
  async remoteObjectForNodeId(context, nodeId) {
    const result = await this._remoteValueForReference(nodeId, true);
    if (!('handle' in result)) throw new Error('Can\'t get remote object for nodeId');
    return createHandle(context, result);
  }
  async contentFrameIdForFrame(handle) {
    const contentWindow = await this._rawCallFunction('e => e.contentWindow', {
      handle: handle._objectId
    });
    if ((contentWindow === null || contentWindow === void 0 ? void 0 : contentWindow.type) === 'window') return contentWindow.value.context;
    return null;
  }
  async frameIdForWindowHandle(handle) {
    if (!handle._objectId) throw new Error('JSHandle is not a DOM node handle');
    const contentWindow = await this._remoteValueForReference({
      handle: handle._objectId
    });
    if (contentWindow.type === 'window') return contentWindow.value.context;
    return null;
  }
  async _remoteValueForReference(reference, createHandle) {
    return await this._rawCallFunction('e => e', reference, createHandle);
  }
  async _rawCallFunction(functionDeclaration, arg, createHandle) {
    const response = await this._session.send('script.callFunction', {
      functionDeclaration,
      target: this._target,
      arguments: [arg],
      // "Root" is necessary for the handle to be returned.
      resultOwnership: createHandle ? bidi.Script.ResultOwnership.Root : bidi.Script.ResultOwnership.None,
      serializationOptions: {
        maxObjectDepth: 0,
        maxDomDepth: 0
      },
      awaitPromise: true,
      userActivation: true
    });
    if (response.type === 'exception') throw new js.JavaScriptErrorInEvaluate(response.exceptionDetails.text + '\nFull val: ' + JSON.stringify(response.exceptionDetails));
    if (response.type === 'success') return response.result;
    throw new js.JavaScriptErrorInEvaluate('Unexpected response type: ' + JSON.stringify(response));
  }
}
exports.BidiExecutionContext = BidiExecutionContext;
function renderPreview(remoteObject) {
  if (remoteObject.type === 'undefined') return 'undefined';
  if (remoteObject.type === 'null') return 'null';
  if ('value' in remoteObject) return String(remoteObject.value);
  return `<${remoteObject.type}>`;
}
function remoteObjectValue(remoteObject) {
  if (remoteObject.type === 'undefined') return undefined;
  if (remoteObject.type === 'null') return null;
  if (remoteObject.type === 'number' && typeof remoteObject.value === 'string') return js.parseUnserializableValue(remoteObject.value);
  if ('value' in remoteObject) return remoteObject.value;
  return undefined;
}
function createHandle(context, remoteObject) {
  if (remoteObject.type === 'node') {
    (0, _utils.assert)(context instanceof dom.FrameExecutionContext);
    return new dom.ElementHandle(context, remoteObject.handle);
  }
  const objectId = 'handle' in remoteObject ? remoteObject.handle : undefined;
  return new js.JSHandle(context, remoteObject.type, renderPreview(remoteObject), objectId, remoteObjectValue(remoteObject));
}