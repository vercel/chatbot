"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AndroidWebView = exports.AndroidSocket = exports.AndroidInput = exports.AndroidDevice = exports.Android = void 0;
var _eventEmitter = require("./eventEmitter");
var _browserContext = require("./browserContext");
var _channelOwner = require("./channelOwner");
var _errors = require("./errors");
var _events = require("./events");
var _waiter = require("./waiter");
var _timeoutSettings = require("./timeoutSettings");
var _rtti = require("../utils/isomorphic/rtti");
var _time = require("../utils/isomorphic/time");
var _timeoutRunner = require("../utils/isomorphic/timeoutRunner");
var _webSocket = require("./webSocket");
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

class Android extends _channelOwner.ChannelOwner {
  static from(android) {
    return android._object;
  }
  constructor(parent, type, guid, initializer) {
    super(parent, type, guid, initializer);
    this._timeoutSettings = void 0;
    this._serverLauncher = void 0;
    this._timeoutSettings = new _timeoutSettings.TimeoutSettings(this._platform);
  }
  setDefaultTimeout(timeout) {
    this._timeoutSettings.setDefaultTimeout(timeout);
    this._wrapApiCall(async () => {
      await this._channel.setDefaultTimeoutNoReply({
        timeout
      });
    }, true).catch(() => {});
  }
  async devices(options = {}) {
    const {
      devices
    } = await this._channel.devices(options);
    return devices.map(d => AndroidDevice.from(d));
  }
  async launchServer(options = {}) {
    if (!this._serverLauncher) throw new Error('Launching server is not supported');
    return await this._serverLauncher.launchServer(options);
  }
  async connect(wsEndpoint, options = {}) {
    return await this._wrapApiCall(async () => {
      const deadline = options.timeout ? (0, _time.monotonicTime)() + options.timeout : 0;
      const headers = {
        'x-playwright-browser': 'android',
        ...options.headers
      };
      const connectParams = {
        wsEndpoint,
        headers,
        slowMo: options.slowMo,
        timeout: options.timeout
      };
      const connection = await (0, _webSocket.connectOverWebSocket)(this._connection, connectParams);
      let device;
      connection.on('close', () => {
        var _device;
        (_device = device) === null || _device === void 0 || _device._didClose();
      });
      const result = await (0, _timeoutRunner.raceAgainstDeadline)(async () => {
        const playwright = await connection.initializePlaywright();
        if (!playwright._initializer.preConnectedAndroidDevice) {
          connection.close();
          throw new Error('Malformed endpoint. Did you use Android.launchServer method?');
        }
        device = AndroidDevice.from(playwright._initializer.preConnectedAndroidDevice);
        device._shouldCloseConnectionOnClose = true;
        device.on(_events.Events.AndroidDevice.Close, () => connection.close());
        return device;
      }, deadline);
      if (!result.timedOut) {
        return result.result;
      } else {
        connection.close();
        throw new Error(`Timeout ${options.timeout}ms exceeded`);
      }
    });
  }
}
exports.Android = Android;
class AndroidDevice extends _channelOwner.ChannelOwner {
  static from(androidDevice) {
    return androidDevice._object;
  }
  constructor(parent, type, guid, initializer) {
    super(parent, type, guid, initializer);
    this._timeoutSettings = void 0;
    this._webViews = new Map();
    this._shouldCloseConnectionOnClose = false;
    this.input = void 0;
    this.input = new AndroidInput(this);
    this._timeoutSettings = new _timeoutSettings.TimeoutSettings(this._platform, parent._timeoutSettings);
    this._channel.on('webViewAdded', ({
      webView
    }) => this._onWebViewAdded(webView));
    this._channel.on('webViewRemoved', ({
      socketName
    }) => this._onWebViewRemoved(socketName));
    this._channel.on('close', () => this._didClose());
  }
  _onWebViewAdded(webView) {
    const view = new AndroidWebView(this, webView);
    this._webViews.set(webView.socketName, view);
    this.emit(_events.Events.AndroidDevice.WebView, view);
  }
  _onWebViewRemoved(socketName) {
    const view = this._webViews.get(socketName);
    this._webViews.delete(socketName);
    if (view) view.emit(_events.Events.AndroidWebView.Close);
  }
  setDefaultTimeout(timeout) {
    this._timeoutSettings.setDefaultTimeout(timeout);
    this._wrapApiCall(async () => {
      await this._channel.setDefaultTimeoutNoReply({
        timeout
      });
    }, true).catch(() => {});
  }
  serial() {
    return this._initializer.serial;
  }
  model() {
    return this._initializer.model;
  }
  webViews() {
    return [...this._webViews.values()];
  }
  async webView(selector, options) {
    const predicate = v => {
      if (selector.pkg) return v.pkg() === selector.pkg;
      if (selector.socketName) return v._socketName() === selector.socketName;
      return false;
    };
    const webView = [...this._webViews.values()].find(predicate);
    if (webView) return webView;
    return await this.waitForEvent('webview', {
      ...options,
      predicate
    });
  }
  async wait(selector, options) {
    await this._channel.wait({
      selector: toSelectorChannel(selector),
      ...options
    });
  }
  async fill(selector, text, options) {
    await this._channel.fill({
      selector: toSelectorChannel(selector),
      text,
      ...options
    });
  }
  async press(selector, key, options) {
    await this.tap(selector, options);
    await this.input.press(key);
  }
  async tap(selector, options) {
    await this._channel.tap({
      selector: toSelectorChannel(selector),
      ...options
    });
  }
  async drag(selector, dest, options) {
    await this._channel.drag({
      selector: toSelectorChannel(selector),
      dest,
      ...options
    });
  }
  async fling(selector, direction, options) {
    await this._channel.fling({
      selector: toSelectorChannel(selector),
      direction,
      ...options
    });
  }
  async longTap(selector, options) {
    await this._channel.longTap({
      selector: toSelectorChannel(selector),
      ...options
    });
  }
  async pinchClose(selector, percent, options) {
    await this._channel.pinchClose({
      selector: toSelectorChannel(selector),
      percent,
      ...options
    });
  }
  async pinchOpen(selector, percent, options) {
    await this._channel.pinchOpen({
      selector: toSelectorChannel(selector),
      percent,
      ...options
    });
  }
  async scroll(selector, direction, percent, options) {
    await this._channel.scroll({
      selector: toSelectorChannel(selector),
      direction,
      percent,
      ...options
    });
  }
  async swipe(selector, direction, percent, options) {
    await this._channel.swipe({
      selector: toSelectorChannel(selector),
      direction,
      percent,
      ...options
    });
  }
  async info(selector) {
    return (await this._channel.info({
      selector: toSelectorChannel(selector)
    })).info;
  }
  async screenshot(options = {}) {
    const {
      binary
    } = await this._channel.screenshot();
    if (options.path) await this._platform.fs().promises.writeFile(options.path, binary);
    return binary;
  }
  async [Symbol.asyncDispose]() {
    await this.close();
  }
  async close() {
    try {
      if (this._shouldCloseConnectionOnClose) this._connection.close();else await this._channel.close();
    } catch (e) {
      if ((0, _errors.isTargetClosedError)(e)) return;
      throw e;
    }
  }
  _didClose() {
    this.emit(_events.Events.AndroidDevice.Close, this);
  }
  async shell(command) {
    const {
      result
    } = await this._channel.shell({
      command
    });
    return result;
  }
  async open(command) {
    return AndroidSocket.from((await this._channel.open({
      command
    })).socket);
  }
  async installApk(file, options) {
    await this._channel.installApk({
      file: await loadFile(this._platform, file),
      args: options && options.args
    });
  }
  async push(file, path, options) {
    await this._channel.push({
      file: await loadFile(this._platform, file),
      path,
      mode: options ? options.mode : undefined
    });
  }
  async launchBrowser(options = {}) {
    const contextOptions = await (0, _browserContext.prepareBrowserContextParams)(this._platform, options);
    const result = await this._channel.launchBrowser(contextOptions);
    const context = _browserContext.BrowserContext.from(result.context);
    context._setOptions(contextOptions, {});
    return context;
  }
  async waitForEvent(event, optionsOrPredicate = {}) {
    return await this._wrapApiCall(async () => {
      const timeout = this._timeoutSettings.timeout(typeof optionsOrPredicate === 'function' ? {} : optionsOrPredicate);
      const predicate = typeof optionsOrPredicate === 'function' ? optionsOrPredicate : optionsOrPredicate.predicate;
      const waiter = _waiter.Waiter.createForEvent(this, event);
      waiter.rejectOnTimeout(timeout, `Timeout ${timeout}ms exceeded while waiting for event "${event}"`);
      if (event !== _events.Events.AndroidDevice.Close) waiter.rejectOnEvent(this, _events.Events.AndroidDevice.Close, () => new _errors.TargetClosedError());
      const result = await waiter.waitForEvent(this, event, predicate);
      waiter.dispose();
      return result;
    });
  }
}
exports.AndroidDevice = AndroidDevice;
class AndroidSocket extends _channelOwner.ChannelOwner {
  static from(androidDevice) {
    return androidDevice._object;
  }
  constructor(parent, type, guid, initializer) {
    super(parent, type, guid, initializer);
    this._channel.on('data', ({
      data
    }) => this.emit(_events.Events.AndroidSocket.Data, data));
    this._channel.on('close', () => this.emit(_events.Events.AndroidSocket.Close));
  }
  async write(data) {
    await this._channel.write({
      data
    });
  }
  async close() {
    await this._channel.close();
  }
  async [Symbol.asyncDispose]() {
    await this.close();
  }
}
exports.AndroidSocket = AndroidSocket;
async function loadFile(platform, file) {
  if ((0, _rtti.isString)(file)) return await platform.fs().promises.readFile(file);
  return file;
}
class AndroidInput {
  constructor(device) {
    this._device = void 0;
    this._device = device;
  }
  async type(text) {
    await this._device._channel.inputType({
      text
    });
  }
  async press(key) {
    await this._device._channel.inputPress({
      key
    });
  }
  async tap(point) {
    await this._device._channel.inputTap({
      point
    });
  }
  async swipe(from, segments, steps) {
    await this._device._channel.inputSwipe({
      segments,
      steps
    });
  }
  async drag(from, to, steps) {
    await this._device._channel.inputDrag({
      from,
      to,
      steps
    });
  }
}
exports.AndroidInput = AndroidInput;
function toSelectorChannel(selector) {
  const {
    checkable,
    checked,
    clazz,
    clickable,
    depth,
    desc,
    enabled,
    focusable,
    focused,
    hasChild,
    hasDescendant,
    longClickable,
    pkg,
    res,
    scrollable,
    selected,
    text
  } = selector;
  const toRegex = value => {
    if (value === undefined) return undefined;
    if ((0, _rtti.isRegExp)(value)) return value.source;
    return '^' + value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d') + '$';
  };
  return {
    checkable,
    checked,
    clazz: toRegex(clazz),
    pkg: toRegex(pkg),
    desc: toRegex(desc),
    res: toRegex(res),
    text: toRegex(text),
    clickable,
    depth,
    enabled,
    focusable,
    focused,
    hasChild: hasChild ? {
      selector: toSelectorChannel(hasChild.selector)
    } : undefined,
    hasDescendant: hasDescendant ? {
      selector: toSelectorChannel(hasDescendant.selector),
      maxDepth: hasDescendant.maxDepth
    } : undefined,
    longClickable,
    scrollable,
    selected
  };
}
class AndroidWebView extends _eventEmitter.EventEmitter {
  constructor(device, data) {
    super(device._platform);
    this._device = void 0;
    this._data = void 0;
    this._pagePromise = void 0;
    this._device = device;
    this._data = data;
  }
  pid() {
    return this._data.pid;
  }
  pkg() {
    return this._data.pkg;
  }
  _socketName() {
    return this._data.socketName;
  }
  async page() {
    if (!this._pagePromise) this._pagePromise = this._fetchPage();
    return await this._pagePromise;
  }
  async _fetchPage() {
    const {
      context
    } = await this._device._channel.connectToWebView({
      socketName: this._data.socketName
    });
    return _browserContext.BrowserContext.from(context).pages()[0];
  }
}
exports.AndroidWebView = AndroidWebView;