"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.BidiPage = void 0;
var _utils = require("../../utils");
var _eventsHelper = require("../utils/eventsHelper");
var _browserContext = require("../browserContext");
var dialog = _interopRequireWildcard(require("../dialog"));
var dom = _interopRequireWildcard(require("../dom"));
var _page = require("../page");
var _bidiExecutionContext = require("./bidiExecutionContext");
var _bidiInput = require("./bidiInput");
var _bidiNetworkManager = require("./bidiNetworkManager");
var _bidiPdf = require("./bidiPdf");
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

const UTILITY_WORLD_NAME = '__playwright_utility_world__';
const kPlaywrightBindingChannel = 'playwrightChannel';
class BidiPage {
  constructor(browserContext, bidiSession, opener) {
    this.rawMouse = void 0;
    this.rawKeyboard = void 0;
    this.rawTouchscreen = void 0;
    this._page = void 0;
    this._session = void 0;
    this._opener = void 0;
    this._realmToContext = void 0;
    this._sessionListeners = [];
    this._browserContext = void 0;
    this._networkManager = void 0;
    this._pdf = void 0;
    this._initScriptIds = [];
    this._session = bidiSession;
    this._opener = opener;
    this.rawKeyboard = new _bidiInput.RawKeyboardImpl(bidiSession);
    this.rawMouse = new _bidiInput.RawMouseImpl(bidiSession);
    this.rawTouchscreen = new _bidiInput.RawTouchscreenImpl(bidiSession);
    this._realmToContext = new Map();
    this._page = new _page.Page(this, browserContext);
    this._browserContext = browserContext;
    this._networkManager = new _bidiNetworkManager.BidiNetworkManager(this._session, this._page, this._onNavigationResponseStarted.bind(this));
    this._pdf = new _bidiPdf.BidiPDF(this._session);
    this._page.on(_page.Page.Events.FrameDetached, frame => this._removeContextsForFrame(frame, false));
    this._sessionListeners = [_eventsHelper.eventsHelper.addEventListener(bidiSession, 'script.realmCreated', this._onRealmCreated.bind(this)), _eventsHelper.eventsHelper.addEventListener(bidiSession, 'script.message', this._onScriptMessage.bind(this)), _eventsHelper.eventsHelper.addEventListener(bidiSession, 'browsingContext.contextDestroyed', this._onBrowsingContextDestroyed.bind(this)), _eventsHelper.eventsHelper.addEventListener(bidiSession, 'browsingContext.navigationStarted', this._onNavigationStarted.bind(this)), _eventsHelper.eventsHelper.addEventListener(bidiSession, 'browsingContext.navigationAborted', this._onNavigationAborted.bind(this)), _eventsHelper.eventsHelper.addEventListener(bidiSession, 'browsingContext.navigationFailed', this._onNavigationFailed.bind(this)), _eventsHelper.eventsHelper.addEventListener(bidiSession, 'browsingContext.fragmentNavigated', this._onFragmentNavigated.bind(this)), _eventsHelper.eventsHelper.addEventListener(bidiSession, 'browsingContext.domContentLoaded', this._onDomContentLoaded.bind(this)), _eventsHelper.eventsHelper.addEventListener(bidiSession, 'browsingContext.load', this._onLoad.bind(this)), _eventsHelper.eventsHelper.addEventListener(bidiSession, 'browsingContext.userPromptOpened', this._onUserPromptOpened.bind(this)), _eventsHelper.eventsHelper.addEventListener(bidiSession, 'log.entryAdded', this._onLogEntryAdded.bind(this))];

    // Initialize main frame.
    // TODO: Wait for first execution context to be created and maybe about:blank navigated.
    this._initialize().then(() => {
      var _this$_opener;
      return this._page.reportAsNew((_this$_opener = this._opener) === null || _this$_opener === void 0 ? void 0 : _this$_opener._page);
    }, error => {
      var _this$_opener2;
      return this._page.reportAsNew((_this$_opener2 = this._opener) === null || _this$_opener2 === void 0 ? void 0 : _this$_opener2._page, error);
    });
  }
  async _initialize() {
    // Initialize main frame.
    this._onFrameAttached(this._session.sessionId, null);
    await Promise.all([this.updateHttpCredentials(), this.updateRequestInterception(), this._updateViewport(), this._installMainBinding(), this._addAllInitScripts()]);
  }
  async _addAllInitScripts() {
    return Promise.all(this._page.allInitScripts().map(initScript => this.addInitScript(initScript)));
  }
  didClose() {
    this._session.dispose();
    _eventsHelper.eventsHelper.removeEventListeners(this._sessionListeners);
    this._page._didClose();
  }
  _onFrameAttached(frameId, parentFrameId) {
    return this._page._frameManager.frameAttached(frameId, parentFrameId);
  }
  _removeContextsForFrame(frame, notifyFrame) {
    for (const [contextId, context] of this._realmToContext) {
      if (context.frame === frame) {
        this._realmToContext.delete(contextId);
        if (notifyFrame) frame._contextDestroyed(context);
      }
    }
  }
  _onRealmCreated(realmInfo) {
    if (this._realmToContext.has(realmInfo.realm)) return;
    if (realmInfo.type !== 'window') return;
    const frame = this._page._frameManager.frame(realmInfo.context);
    if (!frame) return;
    let worldName;
    if (!realmInfo.sandbox) {
      worldName = 'main';
      // Force creating utility world every time the main world is created (e.g. due to navigation).
      this._touchUtilityWorld(realmInfo.context);
    } else if (realmInfo.sandbox === UTILITY_WORLD_NAME) {
      worldName = 'utility';
    } else {
      return;
    }
    const delegate = new _bidiExecutionContext.BidiExecutionContext(this._session, realmInfo);
    const context = new dom.FrameExecutionContext(delegate, frame, worldName);
    frame._contextCreated(worldName, context);
    this._realmToContext.set(realmInfo.realm, context);
  }
  async _touchUtilityWorld(context) {
    await this._session.sendMayFail('script.evaluate', {
      expression: '1 + 1',
      target: {
        context,
        sandbox: UTILITY_WORLD_NAME
      },
      serializationOptions: {
        maxObjectDepth: 10,
        maxDomDepth: 10
      },
      awaitPromise: true,
      userActivation: true
    });
  }
  _onRealmDestroyed(params) {
    const context = this._realmToContext.get(params.realm);
    if (!context) return false;
    this._realmToContext.delete(params.realm);
    context.frame._contextDestroyed(context);
    return true;
  }

  // TODO: route the message directly to the browser
  _onBrowsingContextDestroyed(params) {
    this._browserContext._browser._onBrowsingContextDestroyed(params);
  }
  _onNavigationStarted(params) {
    const frameId = params.context;
    this._page._frameManager.frameRequestedNavigation(frameId, params.navigation);
    const url = params.url.toLowerCase();
    if (url.startsWith('file:') || url.startsWith('data:') || url === 'about:blank') {
      // Navigation to file urls doesn't emit network events, so we fire 'commit' event right when navigation is started.
      // Doing it in domcontentload would be too late as we'd clear frame tree.
      const frame = this._page._frameManager.frame(frameId);
      if (frame) this._page._frameManager.frameCommittedNewDocumentNavigation(frameId, params.url, '', params.navigation, /* initial */false);
    }
  }

  // TODO: there is no separate event for committed navigation, so we approximate it with responseStarted.
  _onNavigationResponseStarted(params) {
    const frameId = params.context;
    const frame = this._page._frameManager.frame(frameId);
    (0, _utils.assert)(frame);
    this._page._frameManager.frameCommittedNewDocumentNavigation(frameId, params.response.url, '', params.navigation, /* initial */false);
    // if (!initial)
    //   this._firstNonInitialNavigationCommittedFulfill();
  }
  _onDomContentLoaded(params) {
    const frameId = params.context;
    this._page._frameManager.frameLifecycleEvent(frameId, 'domcontentloaded');
  }
  _onLoad(params) {
    this._page._frameManager.frameLifecycleEvent(params.context, 'load');
  }
  _onNavigationAborted(params) {
    this._page._frameManager.frameAbortedNavigation(params.context, 'Navigation aborted', params.navigation || undefined);
  }
  _onNavigationFailed(params) {
    this._page._frameManager.frameAbortedNavigation(params.context, 'Navigation failed', params.navigation || undefined);
  }
  _onFragmentNavigated(params) {
    this._page._frameManager.frameCommittedSameDocumentNavigation(params.context, params.url);
  }
  _onUserPromptOpened(event) {
    this._page.emitOnContext(_browserContext.BrowserContext.Events.Dialog, new dialog.Dialog(this._page, event.type, event.message, async (accept, userText) => {
      await this._session.send('browsingContext.handleUserPrompt', {
        context: event.context,
        accept,
        userText
      });
    }, event.defaultValue));
  }
  _onLogEntryAdded(params) {
    var _params$stackTrace;
    if (params.type !== 'console') return;
    const entry = params;
    const context = this._realmToContext.get(params.source.realm);
    if (!context) return;
    const callFrame = (_params$stackTrace = params.stackTrace) === null || _params$stackTrace === void 0 ? void 0 : _params$stackTrace.callFrames[0];
    const location = callFrame !== null && callFrame !== void 0 ? callFrame : {
      url: '',
      lineNumber: 1,
      columnNumber: 1
    };
    this._page._addConsoleMessage(entry.method, entry.args.map(arg => (0, _bidiExecutionContext.createHandle)(context, arg)), location, params.text || undefined);
  }
  async navigateFrame(frame, url, referrer) {
    const {
      navigation
    } = await this._session.send('browsingContext.navigate', {
      context: frame._id,
      url
    });
    return {
      newDocumentId: navigation || undefined
    };
  }
  async updateExtraHTTPHeaders() {}
  async updateEmulateMedia() {}
  async updateEmulatedViewportSize() {
    await this._updateViewport();
  }
  async updateUserAgent() {}
  async bringToFront() {
    await this._session.send('browsingContext.activate', {
      context: this._session.sessionId
    });
  }
  async _updateViewport() {
    const options = this._browserContext._options;
    const deviceSize = this._page.emulatedSize();
    if (deviceSize === null) return;
    const viewportSize = deviceSize.viewport;
    await this._session.send('browsingContext.setViewport', {
      context: this._session.sessionId,
      viewport: {
        width: viewportSize.width,
        height: viewportSize.height
      },
      devicePixelRatio: options.deviceScaleFactor || 1
    });
  }
  async updateRequestInterception() {
    await this._networkManager.setRequestInterception(this._page.needsRequestInterception());
  }
  async updateOffline() {}
  async updateHttpCredentials() {
    await this._networkManager.setCredentials(this._browserContext._options.httpCredentials);
  }
  async updateFileChooserInterception() {}
  async reload() {
    await this._session.send('browsingContext.reload', {
      context: this._session.sessionId,
      // ignoreCache: true,
      wait: bidi.BrowsingContext.ReadinessState.Interactive
    });
  }
  async goBack() {
    return await this._session.send('browsingContext.traverseHistory', {
      context: this._session.sessionId,
      delta: -1
    }).then(() => true).catch(() => false);
  }
  async goForward() {
    return await this._session.send('browsingContext.traverseHistory', {
      context: this._session.sessionId,
      delta: +1
    }).then(() => true).catch(() => false);
  }
  async requestGC() {
    throw new Error('Method not implemented.');
  }

  // TODO: consider calling this only when bindings are added.
  async _installMainBinding() {
    const functionDeclaration = addMainBinding.toString();
    const args = [{
      type: 'channel',
      value: {
        channel: kPlaywrightBindingChannel,
        ownership: bidi.Script.ResultOwnership.Root
      }
    }];
    const promises = [];
    promises.push(this._session.send('script.addPreloadScript', {
      functionDeclaration,
      arguments: args
    }));
    promises.push(this._session.send('script.callFunction', {
      functionDeclaration,
      arguments: args,
      target: toBidiExecutionContext(await this._page.mainFrame()._mainContext())._target,
      awaitPromise: false,
      userActivation: false
    }));
    await Promise.all(promises);
  }
  async _onScriptMessage(event) {
    if (event.channel !== kPlaywrightBindingChannel) return;
    const pageOrError = await this._page.waitForInitializedOrError();
    if (pageOrError instanceof Error) return;
    const context = this._realmToContext.get(event.source.realm);
    if (!context) return;
    if (event.data.type !== 'string') return;
    await this._page._onBindingCalled(event.data.value, context);
  }
  async addInitScript(initScript) {
    const {
      script
    } = await this._session.send('script.addPreloadScript', {
      // TODO: remove function call from the source.
      functionDeclaration: `() => { return ${initScript.source} }`,
      // TODO: push to iframes?
      contexts: [this._session.sessionId]
    });
    if (!initScript.internal) this._initScriptIds.push(script);
  }
  async removeNonInternalInitScripts() {
    const promises = this._initScriptIds.map(script => this._session.send('script.removePreloadScript', {
      script
    }));
    this._initScriptIds = [];
    await Promise.all(promises);
  }
  async closePage(runBeforeUnload) {
    await this._session.send('browsingContext.close', {
      context: this._session.sessionId,
      promptUnload: runBeforeUnload
    });
  }
  async setBackgroundColor(color) {}
  async takeScreenshot(progress, format, documentRect, viewportRect, quality, fitsViewport, scale) {
    const rect = documentRect || viewportRect;
    const {
      data
    } = await this._session.send('browsingContext.captureScreenshot', {
      context: this._session.sessionId,
      format: {
        type: `image/${format === 'png' ? 'png' : 'jpeg'}`,
        quality: quality ? quality / 100 : 0.8
      },
      origin: documentRect ? 'document' : 'viewport',
      clip: {
        type: 'box',
        ...rect
      }
    });
    return Buffer.from(data, 'base64');
  }
  async getContentFrame(handle) {
    const executionContext = toBidiExecutionContext(handle._context);
    const frameId = await executionContext.contentFrameIdForFrame(handle);
    if (!frameId) return null;
    return this._page._frameManager.frame(frameId);
  }
  async getOwnerFrame(handle) {
    // TODO: switch to utility world?
    const windowHandle = await handle.evaluateHandle(node => {
      var _node$ownerDocument;
      const doc = (_node$ownerDocument = node.ownerDocument) !== null && _node$ownerDocument !== void 0 ? _node$ownerDocument : node;
      return doc.defaultView;
    });
    if (!windowHandle) return null;
    const executionContext = toBidiExecutionContext(handle._context);
    return executionContext.frameIdForWindowHandle(windowHandle);
  }
  async getBoundingBox(handle) {
    const box = await handle.evaluate(element => {
      if (!(element instanceof Element)) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      };
    });
    if (!box) return null;
    const position = await this._framePosition(handle._frame);
    if (!position) return null;
    box.x += position.x;
    box.y += position.y;
    return box;
  }

  // TODO: move to Frame.
  async _framePosition(frame) {
    if (frame === this._page.mainFrame()) return {
      x: 0,
      y: 0
    };
    const element = await frame.frameElement();
    const box = await element.boundingBox();
    if (!box) return null;
    const style = await element.evaluateInUtility(([injected, iframe]) => injected.describeIFrameStyle(iframe), {}).catch(e => 'error:notconnected');
    if (style === 'error:notconnected' || style === 'transformed') return null;
    // Content box is offset by border and padding widths.
    box.x += style.left;
    box.y += style.top;
    return box;
  }
  async scrollRectIntoViewIfNeeded(handle, rect) {
    return await handle.evaluateInUtility(([injected, node]) => {
      node.scrollIntoView({
        block: 'center',
        inline: 'center',
        behavior: 'instant'
      });
    }, null).then(() => 'done').catch(e => {
      if (e instanceof Error && e.message.includes('Node is detached from document')) return 'error:notconnected';
      if (e instanceof Error && e.message.includes('Node does not have a layout object')) return 'error:notvisible';
      throw e;
    });
  }
  async setScreencastOptions(options) {}
  rafCountForStablePosition() {
    return 1;
  }
  async getContentQuads(handle) {
    const quads = await handle.evaluateInUtility(([injected, node]) => {
      if (!node.isConnected) return 'error:notconnected';
      const rects = node.getClientRects();
      if (!rects) return null;
      return [...rects].map(rect => [{
        x: rect.left,
        y: rect.top
      }, {
        x: rect.right,
        y: rect.top
      }, {
        x: rect.right,
        y: rect.bottom
      }, {
        x: rect.left,
        y: rect.bottom
      }]);
    }, null);
    if (!quads || quads === 'error:notconnected') return quads;
    // TODO: consider transforming quads to support clicks in iframes.
    const position = await this._framePosition(handle._frame);
    if (!position) return null;
    quads.forEach(quad => quad.forEach(point => {
      point.x += position.x;
      point.y += position.y;
    }));
    return quads;
  }
  async setInputFilePaths(handle, paths) {
    const fromContext = toBidiExecutionContext(handle._context);
    await this._session.send('input.setFiles', {
      context: this._session.sessionId,
      element: await fromContext.nodeIdForElementHandle(handle),
      files: paths
    });
  }
  async adoptElementHandle(handle, to) {
    const fromContext = toBidiExecutionContext(handle._context);
    const nodeId = await fromContext.nodeIdForElementHandle(handle);
    const executionContext = toBidiExecutionContext(to);
    return await executionContext.remoteObjectForNodeId(to, nodeId);
  }
  async getAccessibilityTree(needle) {
    throw new Error('Method not implemented.');
  }
  async inputActionEpilogue() {}
  async resetForReuse() {}
  async pdf(options) {
    return this._pdf.generate(options);
  }
  async getFrameElement(frame) {
    const parent = frame.parentFrame();
    if (!parent) throw new Error('Frame has been detached.');
    const parentContext = await parent._mainContext();
    const list = await parentContext.evaluateHandle(() => {
      return [...document.querySelectorAll('iframe,frame')];
    });
    const length = await list.evaluate(list => list.length);
    let foundElement = null;
    for (let i = 0; i < length; i++) {
      const element = await list.evaluateHandle((list, i) => list[i], i);
      const candidate = await element.contentFrame();
      if (frame === candidate) {
        foundElement = element;
        break;
      } else {
        element.dispose();
      }
    }
    list.dispose();
    if (!foundElement) throw new Error('Frame has been detached.');
    return foundElement;
  }
  shouldToggleStyleSheetToSyncAnimations() {
    return true;
  }
}
exports.BidiPage = BidiPage;
function addMainBinding(callback) {
  globalThis['__playwright__binding__'] = callback;
}
function toBidiExecutionContext(executionContext) {
  return executionContext.delegate;
}