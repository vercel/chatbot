"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.BrowserContext = void 0;
exports.assertBrowserContextIsNotOwned = assertBrowserContextIsNotOwned;
exports.normalizeProxySettings = normalizeProxySettings;
exports.validateBrowserContextOptions = validateBrowserContextOptions;
exports.verifyClientCertificates = verifyClientCertificates;
exports.verifyGeolocation = verifyGeolocation;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _timeoutSettings = require("./timeoutSettings");
var _crypto = require("./utils/crypto");
var _debug = require("./utils/debug");
var _clock = require("./clock");
var _debugger = require("./debugger");
var _fetch = require("./fetch");
var _fileUtils = require("./utils/fileUtils");
var _harRecorder = require("./har/harRecorder");
var _helper = require("./helper");
var _instrumentation = require("./instrumentation");
var utilityScriptSerializers = _interopRequireWildcard(require("./isomorphic/utilityScriptSerializers"));
var network = _interopRequireWildcard(require("./network"));
var _page6 = require("./page");
var _recorder = require("./recorder");
var _recorderApp = require("./recorder/recorderApp");
var storageScript = _interopRequireWildcard(require("./storageScript"));
var consoleApiSource = _interopRequireWildcard(require("../generated/consoleApiSource"));
var _tracing = require("./trace/recorder/tracing");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

class BrowserContext extends _instrumentation.SdkObject {
  constructor(browser, options, browserContextId) {
    super(browser, 'browser-context');
    this._timeoutSettings = new _timeoutSettings.TimeoutSettings();
    this._pageBindings = new Map();
    this._activeProgressControllers = new Set();
    this._options = void 0;
    this._requestInterceptor = void 0;
    this._isPersistentContext = void 0;
    this._closedStatus = 'open';
    this._closePromise = void 0;
    this._closePromiseFulfill = void 0;
    this._permissions = new Map();
    this._downloads = new Set();
    this._browser = void 0;
    this._browserContextId = void 0;
    this._selectors = void 0;
    this._origins = new Set();
    this._harRecorders = new Map();
    this.tracing = void 0;
    this.fetchRequest = void 0;
    this._customCloseHandler = void 0;
    this._tempDirs = [];
    this._settingStorageState = false;
    this.initScripts = [];
    this._routesInFlight = new Set();
    this._debugger = void 0;
    this._closeReason = void 0;
    this.clock = void 0;
    this._clientCertificatesProxy = void 0;
    this.attribution.context = this;
    this._browser = browser;
    this._options = options;
    this._browserContextId = browserContextId;
    this._isPersistentContext = !browserContextId;
    this._closePromise = new Promise(fulfill => this._closePromiseFulfill = fulfill);
    this.fetchRequest = new _fetch.BrowserContextAPIRequestContext(this);
    if (this._options.recordHar) this._harRecorders.set('', new _harRecorder.HarRecorder(this, null, this._options.recordHar));
    this.tracing = new _tracing.Tracing(this, browser.options.tracesDir);
    this.clock = new _clock.Clock(this);
  }
  isPersistentContext() {
    return this._isPersistentContext;
  }
  setSelectors(selectors) {
    this._selectors = selectors;
  }
  selectors() {
    return this._selectors || this.attribution.playwright.selectors;
  }
  async _initialize() {
    if (this.attribution.playwright.options.isInternalPlaywright) return;
    // Debugger will pause execution upon page.pause in headed mode.
    this._debugger = new _debugger.Debugger(this);

    // When PWDEBUG=1, show inspector for each context.
    if ((0, _debug.debugMode)() === 'inspector') await _recorder.Recorder.show(this, _recorderApp.RecorderApp.factory(this), {
      pauseOnNextStatement: true
    });

    // When paused, show inspector.
    if (this._debugger.isPaused()) _recorder.Recorder.showInspectorNoReply(this, _recorderApp.RecorderApp.factory(this));
    this._debugger.on(_debugger.Debugger.Events.PausedStateChanged, () => {
      if (this._debugger.isPaused()) _recorder.Recorder.showInspectorNoReply(this, _recorderApp.RecorderApp.factory(this));
    });
    if ((0, _debug.debugMode)() === 'console') await this.extendInjectedScript(consoleApiSource.source);
    if (this._options.serviceWorkers === 'block') await this.addInitScript(`\nif (navigator.serviceWorker) navigator.serviceWorker.register = async () => { console.warn('Service Worker registration blocked by Playwright'); };\n`);
    if (this._options.permissions) await this.grantPermissions(this._options.permissions);
  }
  debugger() {
    return this._debugger;
  }
  async _ensureVideosPath() {
    if (this._options.recordVideo) await (0, _fileUtils.mkdirIfNeeded)(_path.default.join(this._options.recordVideo.dir, 'dummy'));
  }
  canResetForReuse() {
    if (this._closedStatus !== 'open') return false;
    return true;
  }
  async stopPendingOperations(reason) {
    // When using context reuse, stop pending operations to gracefully terminate all the actions
    // with a user-friendly error message containing operation log.
    for (const controller of this._activeProgressControllers) controller.abort(new Error(reason));
    // Let rejections in microtask generate events before returning.
    await new Promise(f => setTimeout(f, 0));
  }
  static reusableContextHash(params) {
    const paramsCopy = {
      ...params
    };
    for (const k of Object.keys(paramsCopy)) {
      const key = k;
      if (paramsCopy[key] === defaultNewContextParamValues[key]) delete paramsCopy[key];
    }
    for (const key of paramsThatAllowContextReuse) delete paramsCopy[key];
    return JSON.stringify(paramsCopy);
  }
  async resetForReuse(metadata, params) {
    var _page, _page2, _page3, _page4, _page5;
    this.setDefaultNavigationTimeout(undefined);
    this.setDefaultTimeout(undefined);
    this.tracing.resetForReuse();
    if (params) {
      for (const key of paramsThatAllowContextReuse) this._options[key] = params[key];
    }
    await this._cancelAllRoutesInFlight();

    // Close extra pages early.
    let page = this.pages()[0];
    const [, ...otherPages] = this.pages();
    for (const p of otherPages) await p.close(metadata);
    if (page && page.hasCrashed()) {
      await page.close(metadata);
      page = undefined;
    }

    // Unless dialogs are dismissed, setting extra http headers below does not respond.
    (_page = page) === null || _page === void 0 || _page._frameManager.setCloseAllOpeningDialogs(true);
    await ((_page2 = page) === null || _page2 === void 0 ? void 0 : _page2._frameManager.closeOpenDialogs());
    // Navigate to about:blank first to ensure no page scripts are running after this point.
    await ((_page3 = page) === null || _page3 === void 0 ? void 0 : _page3.mainFrame().goto(metadata, 'about:blank', {
      timeout: 0
    }));
    (_page4 = page) === null || _page4 === void 0 || _page4._frameManager.setCloseAllOpeningDialogs(false);
    await this._resetStorage();
    await this._removeExposedBindings();
    await this._removeInitScripts();
    this.clock.markAsUninstalled();
    // TODO: following can be optimized to not perform noops.
    if (this._options.permissions) await this.grantPermissions(this._options.permissions);else await this.clearPermissions();
    await this.setExtraHTTPHeaders(this._options.extraHTTPHeaders || []);
    await this.setGeolocation(this._options.geolocation);
    await this.setOffline(!!this._options.offline);
    await this.setUserAgent(this._options.userAgent);
    await this.clearCache();
    await this._resetCookies();
    await ((_page5 = page) === null || _page5 === void 0 ? void 0 : _page5.resetForReuse(metadata));
  }
  _browserClosed() {
    for (const page of this.pages()) page._didClose();
    this._didCloseInternal();
  }
  _didCloseInternal() {
    var _this$_clientCertific;
    if (this._closedStatus === 'closed') {
      // We can come here twice if we close browser context and browser
      // at the same time.
      return;
    }
    (_this$_clientCertific = this._clientCertificatesProxy) === null || _this$_clientCertific === void 0 || _this$_clientCertific.close().catch(() => {});
    this.tracing.abort();
    if (this._isPersistentContext) this.onClosePersistent();
    this._closePromiseFulfill(new Error('Context closed'));
    this.emit(BrowserContext.Events.Close);
  }
  pages() {
    return this.possiblyUninitializedPages().filter(page => page.initializedOrUndefined());
  }

  // BrowserContext methods.

  async cookies(urls = []) {
    if (urls && !Array.isArray(urls)) urls = [urls];
    return await this.doGetCookies(urls);
  }
  async clearCookies(options) {
    const currentCookies = await this.cookies();
    await this.doClearCookies();
    const matches = (cookie, prop, value) => {
      if (!value) return true;
      if (value instanceof RegExp) {
        value.lastIndex = 0;
        return value.test(cookie[prop]);
      }
      return cookie[prop] === value;
    };
    const cookiesToReadd = currentCookies.filter(cookie => {
      return !matches(cookie, 'name', options.name) || !matches(cookie, 'domain', options.domain) || !matches(cookie, 'path', options.path);
    });
    await this.addCookies(cookiesToReadd);
  }
  setHTTPCredentials(httpCredentials) {
    return this.doSetHTTPCredentials(httpCredentials);
  }
  hasBinding(name) {
    return this._pageBindings.has(name);
  }
  async exposeBinding(name, needsHandle, playwrightBinding) {
    if (this._pageBindings.has(name)) throw new Error(`Function "${name}" has been already registered`);
    for (const page of this.pages()) {
      if (page.getBinding(name)) throw new Error(`Function "${name}" has been already registered in one of the pages`);
    }
    const binding = new _page6.PageBinding(name, playwrightBinding, needsHandle);
    this._pageBindings.set(name, binding);
    await this.doAddInitScript(binding.initScript);
    const frames = this.pages().map(page => page.frames()).flat();
    await Promise.all(frames.map(frame => frame.evaluateExpression(binding.initScript.source).catch(e => {})));
  }
  async _removeExposedBindings() {
    for (const [key, binding] of this._pageBindings) {
      if (!binding.internal) this._pageBindings.delete(key);
    }
  }
  async grantPermissions(permissions, origin) {
    let resolvedOrigin = '*';
    if (origin) {
      const url = new URL(origin);
      resolvedOrigin = url.origin;
    }
    const existing = new Set(this._permissions.get(resolvedOrigin) || []);
    permissions.forEach(p => existing.add(p));
    const list = [...existing.values()];
    this._permissions.set(resolvedOrigin, list);
    await this.doGrantPermissions(resolvedOrigin, list);
  }
  async clearPermissions() {
    this._permissions.clear();
    await this.doClearPermissions();
  }
  setDefaultNavigationTimeout(timeout) {
    this._timeoutSettings.setDefaultNavigationTimeout(timeout);
  }
  setDefaultTimeout(timeout) {
    this._timeoutSettings.setDefaultTimeout(timeout);
  }
  async _loadDefaultContextAsIs(progress) {
    if (!this.possiblyUninitializedPages().length) {
      const waitForEvent = _helper.helper.waitForEvent(progress, this, BrowserContext.Events.Page);
      progress.cleanupWhenAborted(() => waitForEvent.dispose);
      // Race against BrowserContext.close
      await Promise.race([waitForEvent.promise, this._closePromise]);
    }
    const page = this.possiblyUninitializedPages()[0];
    if (!page) return;
    const pageOrError = await page.waitForInitializedOrError();
    if (pageOrError instanceof Error) throw pageOrError;
    await page.mainFrame()._waitForLoadState(progress, 'load');
    return page;
  }
  async _loadDefaultContext(progress) {
    const defaultPage = await this._loadDefaultContextAsIs(progress);
    if (!defaultPage) return;
    const browserName = this._browser.options.name;
    if (this._options.isMobile && browserName === 'chromium' || this._options.locale && browserName === 'webkit') {
      // Workaround for:
      // - chromium fails to change isMobile for existing page;
      // - webkit fails to change locale for existing page.
      await this.newPage(progress.metadata);
      await defaultPage.close(progress.metadata);
    }
  }
  _authenticateProxyViaHeader() {
    const proxy = this._options.proxy || this._browser.options.proxy || {
      username: undefined,
      password: undefined
    };
    const {
      username,
      password
    } = proxy;
    if (username) {
      this._options.httpCredentials = {
        username,
        password: password
      };
      const token = Buffer.from(`${username}:${password}`).toString('base64');
      this._options.extraHTTPHeaders = network.mergeHeaders([this._options.extraHTTPHeaders, network.singleHeader('Proxy-Authorization', `Basic ${token}`)]);
    }
  }
  _authenticateProxyViaCredentials() {
    const proxy = this._options.proxy || this._browser.options.proxy;
    if (!proxy) return;
    const {
      username,
      password
    } = proxy;
    if (username) this._options.httpCredentials = {
      username,
      password: password || ''
    };
  }
  async addInitScript(source, name) {
    const initScript = new _page6.InitScript(source, false /* internal */, name);
    this.initScripts.push(initScript);
    await this.doAddInitScript(initScript);
  }
  async _removeInitScripts() {
    this.initScripts = this.initScripts.filter(script => script.internal);
    await this.doRemoveNonInternalInitScripts();
  }
  async setRequestInterceptor(handler) {
    this._requestInterceptor = handler;
    await this.doUpdateRequestInterception();
  }
  isClosingOrClosed() {
    return this._closedStatus !== 'open';
  }
  async _deleteAllDownloads() {
    await Promise.all(Array.from(this._downloads).map(download => download.artifact.deleteOnContextClose()));
  }
  async _deleteAllTempDirs() {
    await Promise.all(this._tempDirs.map(async dir => await _fs.default.promises.unlink(dir).catch(e => {})));
  }
  setCustomCloseHandler(handler) {
    this._customCloseHandler = handler;
  }
  async close(options) {
    if (this._closedStatus === 'open') {
      if (options.reason) this._closeReason = options.reason;
      this.emit(BrowserContext.Events.BeforeClose);
      this._closedStatus = 'closing';
      for (const harRecorder of this._harRecorders.values()) await harRecorder.flush();
      await this.tracing.flush();

      // Cleanup.
      const promises = [];
      for (const {
        context,
        artifact
      } of this._browser._idToVideo.values()) {
        // Wait for the videos to finish.
        if (context === this) promises.push(artifact.finishedPromise());
      }
      if (this._customCloseHandler) {
        await this._customCloseHandler();
      } else {
        // Close the context.
        await this.doClose(options.reason);
      }

      // We delete downloads after context closure
      // so that browser does not write to the download file anymore.
      promises.push(this._deleteAllDownloads());
      promises.push(this._deleteAllTempDirs());
      await Promise.all(promises);

      // Custom handler should trigger didCloseInternal itself.
      if (!this._customCloseHandler) this._didCloseInternal();
    }
    await this._closePromise;
  }
  async newPage(metadata) {
    const page = await this.doCreateNewPage();
    if (metadata.isServerSide) page.markAsServerSideOnly();
    const pageOrError = await page.waitForInitializedOrError();
    if (pageOrError instanceof _page6.Page) {
      if (pageOrError.isClosed()) throw new Error('Page has been closed.');
      return pageOrError;
    }
    throw pageOrError;
  }
  addVisitedOrigin(origin) {
    this._origins.add(origin);
  }
  async storageState(indexedDB = false) {
    const result = {
      cookies: await this.cookies(),
      origins: []
    };
    const originsToSave = new Set(this._origins);
    const collectScript = `(${storageScript.collect})((${utilityScriptSerializers.source})(), ${this._browser.options.name === 'firefox'}, ${indexedDB})`;

    // First try collecting storage stage from existing pages.
    for (const page of this.pages()) {
      const origin = page.mainFrame().origin();
      if (!origin || !originsToSave.has(origin)) continue;
      try {
        var _storage$indexedDB;
        const storage = await page.mainFrame().nonStallingEvaluateInExistingContext(collectScript, 'utility');
        if (storage.localStorage.length || (_storage$indexedDB = storage.indexedDB) !== null && _storage$indexedDB !== void 0 && _storage$indexedDB.length) result.origins.push({
          origin,
          localStorage: storage.localStorage,
          indexedDB: storage.indexedDB
        });
        originsToSave.delete(origin);
      } catch {
        // When failed on the live page, we'll retry on the blank page below.
      }
    }

    // If there are still origins to save, create a blank page to iterate over origins.
    if (originsToSave.size) {
      const internalMetadata = (0, _instrumentation.serverSideCallMetadata)();
      const page = await this.newPage(internalMetadata);
      await page._setServerRequestInterceptor(handler => {
        handler.fulfill({
          body: '<html></html>'
        }).catch(() => {});
        return true;
      });
      for (const origin of originsToSave) {
        var _storage$indexedDB2;
        const frame = page.mainFrame();
        await frame.goto(internalMetadata, origin);
        const storage = await frame.evaluateExpression(collectScript, {
          world: 'utility'
        });
        if (storage.localStorage.length || (_storage$indexedDB2 = storage.indexedDB) !== null && _storage$indexedDB2 !== void 0 && _storage$indexedDB2.length) result.origins.push({
          origin,
          localStorage: storage.localStorage,
          indexedDB: storage.indexedDB
        });
      }
      await page.close(internalMetadata);
    }
    return result;
  }
  async _resetStorage() {
    var _this$_options$storag;
    const oldOrigins = this._origins;
    const newOrigins = new Map(((_this$_options$storag = this._options.storageState) === null || _this$_options$storag === void 0 || (_this$_options$storag = _this$_options$storag.origins) === null || _this$_options$storag === void 0 ? void 0 : _this$_options$storag.map(p => [p.origin, p])) || []);
    if (!oldOrigins.size && !newOrigins.size) return;
    let page = this.pages()[0];
    const internalMetadata = (0, _instrumentation.serverSideCallMetadata)();
    page = page || (await this.newPage({
      ...internalMetadata,
      // Do not mark this page as internal, because we will leave it for later reuse
      // as a user-visible page.
      isServerSide: false
    }));
    await page._setServerRequestInterceptor(handler => {
      handler.fulfill({
        body: '<html></html>'
      }).catch(() => {});
      return true;
    });
    for (const origin of new Set([...oldOrigins, ...newOrigins.keys()])) {
      const frame = page.mainFrame();
      await frame.goto(internalMetadata, origin);
      await frame.resetStorageForCurrentOriginBestEffort(newOrigins.get(origin));
    }
    await page._setServerRequestInterceptor(undefined);
    this._origins = new Set([...newOrigins.keys()]);
    // It is safe to not restore the URL to about:blank since we are doing it in Page::resetForReuse.
  }
  async _resetCookies() {
    var _this$_options$storag2, _this$_options$storag3;
    await this.doClearCookies();
    if ((_this$_options$storag2 = this._options.storageState) !== null && _this$_options$storag2 !== void 0 && _this$_options$storag2.cookies) await this.addCookies((_this$_options$storag3 = this._options.storageState) === null || _this$_options$storag3 === void 0 ? void 0 : _this$_options$storag3.cookies);
  }
  isSettingStorageState() {
    return this._settingStorageState;
  }
  async setStorageState(metadata, state) {
    this._settingStorageState = true;
    try {
      if (state.cookies) await this.addCookies(state.cookies);
      if (state.origins && state.origins.length) {
        const internalMetadata = (0, _instrumentation.serverSideCallMetadata)();
        const page = await this.newPage(internalMetadata);
        await page._setServerRequestInterceptor(handler => {
          handler.fulfill({
            body: '<html></html>'
          }).catch(() => {});
          return true;
        });
        for (const originState of state.origins) {
          const frame = page.mainFrame();
          await frame.goto(metadata, originState.origin);
          await frame.evaluateExpression(`(${storageScript.restore})(${JSON.stringify(originState)}, (${utilityScriptSerializers.source})())`, {
            world: 'utility'
          });
        }
        await page.close(internalMetadata);
      }
    } finally {
      this._settingStorageState = false;
    }
  }
  async extendInjectedScript(source, arg) {
    const installInFrame = frame => frame.extendInjectedScript(source, arg).catch(() => {});
    const installInPage = page => {
      page.on(_page6.Page.Events.InternalFrameNavigatedToNewDocument, installInFrame);
      return Promise.all(page.frames().map(installInFrame));
    };
    this.on(BrowserContext.Events.Page, installInPage);
    return Promise.all(this.pages().map(installInPage));
  }
  async safeNonStallingEvaluateInAllFrames(expression, world, options = {}) {
    await Promise.all(this.pages().map(page => page.safeNonStallingEvaluateInAllFrames(expression, world, options)));
  }
  async _harStart(page, options) {
    const harId = (0, _crypto.createGuid)();
    this._harRecorders.set(harId, new _harRecorder.HarRecorder(this, page, options));
    return harId;
  }
  async _harExport(harId) {
    const recorder = this._harRecorders.get(harId || '');
    return recorder.export();
  }
  addRouteInFlight(route) {
    this._routesInFlight.add(route);
  }
  removeRouteInFlight(route) {
    this._routesInFlight.delete(route);
  }
  async _cancelAllRoutesInFlight() {
    await Promise.all([...this._routesInFlight].map(r => r.abort())).catch(() => {});
    this._routesInFlight.clear();
  }
}
exports.BrowserContext = BrowserContext;
BrowserContext.Events = {
  Console: 'console',
  Close: 'close',
  Dialog: 'dialog',
  Page: 'page',
  // Can't use just 'error' due to node.js special treatment of error events.
  // @see https://nodejs.org/api/events.html#events_error_events
  PageError: 'pageerror',
  Request: 'request',
  Response: 'response',
  RequestFailed: 'requestfailed',
  RequestFinished: 'requestfinished',
  RequestAborted: 'requestaborted',
  RequestFulfilled: 'requestfulfilled',
  RequestContinued: 'requestcontinued',
  BeforeClose: 'beforeclose',
  VideoStarted: 'videostarted'
};
function assertBrowserContextIsNotOwned(context) {
  for (const page of context.pages()) {
    if (page._ownedContext) throw new Error('Please use browser.newContext() for multi-page scripts that share the context.');
  }
}
function validateBrowserContextOptions(options, browserOptions) {
  if (options.noDefaultViewport && options.deviceScaleFactor !== undefined) throw new Error(`"deviceScaleFactor" option is not supported with null "viewport"`);
  if (options.noDefaultViewport && !!options.isMobile) throw new Error(`"isMobile" option is not supported with null "viewport"`);
  if (options.acceptDownloads === undefined && browserOptions.name !== 'electron') options.acceptDownloads = 'accept';
  // Electron requires explicit acceptDownloads: true since we wait for
  // https://github.com/electron/electron/pull/41718 to be widely shipped.
  // In 6-12 months, we can remove this check.
  else if (options.acceptDownloads === undefined && browserOptions.name === 'electron') options.acceptDownloads = 'internal-browser-default';
  if (!options.viewport && !options.noDefaultViewport) options.viewport = {
    width: 1280,
    height: 720
  };
  if (options.recordVideo) {
    if (!options.recordVideo.size) {
      if (options.noDefaultViewport) {
        options.recordVideo.size = {
          width: 800,
          height: 600
        };
      } else {
        const size = options.viewport;
        const scale = Math.min(1, 800 / Math.max(size.width, size.height));
        options.recordVideo.size = {
          width: Math.floor(size.width * scale),
          height: Math.floor(size.height * scale)
        };
      }
    }
    // Make sure both dimensions are odd, this is required for vp8
    options.recordVideo.size.width &= ~1;
    options.recordVideo.size.height &= ~1;
  }
  if (options.proxy) options.proxy = normalizeProxySettings(options.proxy);
  verifyGeolocation(options.geolocation);
}
function verifyGeolocation(geolocation) {
  if (!geolocation) return;
  geolocation.accuracy = geolocation.accuracy || 0;
  const {
    longitude,
    latitude,
    accuracy
  } = geolocation;
  if (longitude < -180 || longitude > 180) throw new Error(`geolocation.longitude: precondition -180 <= LONGITUDE <= 180 failed.`);
  if (latitude < -90 || latitude > 90) throw new Error(`geolocation.latitude: precondition -90 <= LATITUDE <= 90 failed.`);
  if (accuracy < 0) throw new Error(`geolocation.accuracy: precondition 0 <= ACCURACY failed.`);
}
function verifyClientCertificates(clientCertificates) {
  if (!clientCertificates) return;
  for (const cert of clientCertificates) {
    if (!cert.origin) throw new Error(`clientCertificates.origin is required`);
    if (!cert.cert && !cert.key && !cert.passphrase && !cert.pfx) throw new Error('None of cert, key, passphrase or pfx is specified');
    if (cert.cert && !cert.key) throw new Error('cert is specified without key');
    if (!cert.cert && cert.key) throw new Error('key is specified without cert');
    if (cert.pfx && (cert.cert || cert.key)) throw new Error('pfx is specified together with cert, key or passphrase');
  }
}
function normalizeProxySettings(proxy) {
  let {
    server,
    bypass
  } = proxy;
  let url;
  try {
    // new URL('127.0.0.1:8080') throws
    // new URL('localhost:8080') fails to parse host or protocol
    // In both of these cases, we need to try re-parse URL with `http://` prefix.
    url = new URL(server);
    if (!url.host || !url.protocol) url = new URL('http://' + server);
  } catch (e) {
    url = new URL('http://' + server);
  }
  if (url.protocol === 'socks4:' && (proxy.username || proxy.password)) throw new Error(`Socks4 proxy protocol does not support authentication`);
  if (url.protocol === 'socks5:' && (proxy.username || proxy.password)) throw new Error(`Browser does not support socks5 proxy authentication`);
  server = url.protocol + '//' + url.host;
  if (bypass) bypass = bypass.split(',').map(t => t.trim()).join(',');
  return {
    ...proxy,
    server,
    bypass
  };
}
const paramsThatAllowContextReuse = ['colorScheme', 'forcedColors', 'reducedMotion', 'contrast', 'screen', 'userAgent', 'viewport'];
const defaultNewContextParamValues = {
  noDefaultViewport: false,
  ignoreHTTPSErrors: false,
  javaScriptEnabled: true,
  bypassCSP: false,
  offline: false,
  isMobile: false,
  hasTouch: false,
  acceptDownloads: 'accept',
  strictSelectors: false,
  serviceWorkers: 'allow',
  locale: 'en-US'
};