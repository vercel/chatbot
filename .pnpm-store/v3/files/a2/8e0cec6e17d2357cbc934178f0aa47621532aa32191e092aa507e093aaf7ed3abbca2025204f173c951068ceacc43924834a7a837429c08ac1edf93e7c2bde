"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Network = exports.BidiBrowserContext = exports.BidiBrowser = void 0;
var _eventsHelper = require("../utils/eventsHelper");
var _browser = require("../browser");
var _browserContext = require("../browserContext");
var network = _interopRequireWildcard(require("../network"));
var _bidiConnection = require("./bidiConnection");
var _bidiNetworkManager = require("./bidiNetworkManager");
var _bidiPage = require("./bidiPage");
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

class BidiBrowser extends _browser.Browser {
  static async connect(parent, transport, options) {
    const browser = new BidiBrowser(parent, transport, options);
    if (options.__testHookOnConnectToBrowser) await options.__testHookOnConnectToBrowser();
    let proxy;
    if (options.proxy) {
      proxy = {
        proxyType: 'manual'
      };
      const url = new URL(options.proxy.server); // Validate proxy server.
      switch (url.protocol) {
        case 'http:':
          proxy.httpProxy = url.host;
          break;
        case 'https:':
          proxy.httpsProxy = url.host;
          break;
        case 'socks4:':
          proxy.socksProxy = url.host;
          proxy.socksVersion = 4;
          break;
        case 'socks5:':
          proxy.socksProxy = url.host;
          proxy.socksVersion = 5;
          break;
        default:
          throw new Error('Invalid proxy server protocol: ' + options.proxy.server);
      }
      if (options.proxy.bypass) proxy.noProxy = options.proxy.bypass.split(',');
      // TODO: support authentication.
    }
    browser._bidiSessionInfo = await browser._browserSession.send('session.new', {
      capabilities: {
        alwaysMatch: {
          acceptInsecureCerts: false,
          proxy,
          unhandledPromptBehavior: {
            default: bidi.Session.UserPromptHandlerType.Ignore
          },
          webSocketUrl: true
        }
      }
    });
    await browser._browserSession.send('session.subscribe', {
      events: ['browsingContext', 'network', 'log', 'script']
    });
    if (options.persistent) {
      browser._defaultContext = new BidiBrowserContext(browser, undefined, options.persistent);
      await browser._defaultContext._initialize();
      // Create default page as we cannot get access to the existing one.
      const page = await browser._defaultContext.doCreateNewPage();
      await page.waitForInitializedOrError();
    }
    return browser;
  }
  constructor(parent, transport, options) {
    super(parent, options);
    this._connection = void 0;
    this._browserSession = void 0;
    this._bidiSessionInfo = void 0;
    this._contexts = new Map();
    this._bidiPages = new Map();
    this._eventListeners = void 0;
    this._connection = new _bidiConnection.BidiConnection(transport, this._onDisconnect.bind(this), options.protocolLogger, options.browserLogsCollector);
    this._browserSession = this._connection.browserSession;
    this._eventListeners = [_eventsHelper.eventsHelper.addEventListener(this._browserSession, 'browsingContext.contextCreated', this._onBrowsingContextCreated.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._browserSession, 'script.realmDestroyed', this._onScriptRealmDestroyed.bind(this))];
  }
  _onDisconnect() {
    this._didClose();
  }
  async doCreateNewContext(options) {
    const {
      userContext
    } = await this._browserSession.send('browser.createUserContext', {});
    const context = new BidiBrowserContext(this, userContext, options);
    await context._initialize();
    this._contexts.set(userContext, context);
    return context;
  }
  contexts() {
    return Array.from(this._contexts.values());
  }
  version() {
    return this._bidiSessionInfo.capabilities.browserVersion;
  }
  userAgent() {
    return this._bidiSessionInfo.capabilities.userAgent;
  }
  isConnected() {
    return !this._connection.isClosed();
  }
  _onBrowsingContextCreated(event) {
    if (event.parent) {
      const parentFrameId = event.parent;
      for (const page of this._bidiPages.values()) {
        const parentFrame = page._page._frameManager.frame(parentFrameId);
        if (!parentFrame) continue;
        page._session.addFrameBrowsingContext(event.context);
        page._page._frameManager.frameAttached(event.context, parentFrameId);
        const frame = page._page._frameManager.frame(event.context);
        if (frame) frame._url = event.url;
        return;
      }
      return;
    }
    let context = this._contexts.get(event.userContext);
    if (!context) context = this._defaultContext;
    if (!context) return;
    const session = this._connection.createMainFrameBrowsingContextSession(event.context);
    const opener = event.originalOpener && this._bidiPages.get(event.originalOpener);
    const page = new _bidiPage.BidiPage(context, session, opener || null);
    page._page.mainFrame()._url = event.url;
    this._bidiPages.set(event.context, page);
  }
  _onBrowsingContextDestroyed(event) {
    if (event.parent) {
      this._browserSession.removeFrameBrowsingContext(event.context);
      const parentFrameId = event.parent;
      for (const page of this._bidiPages.values()) {
        const parentFrame = page._page._frameManager.frame(parentFrameId);
        if (!parentFrame) continue;
        page._page._frameManager.frameDetached(event.context);
        return;
      }
      return;
    }
    const bidiPage = this._bidiPages.get(event.context);
    if (!bidiPage) return;
    bidiPage.didClose();
    this._bidiPages.delete(event.context);
  }
  _onScriptRealmDestroyed(event) {
    for (const page of this._bidiPages.values()) {
      if (page._onRealmDestroyed(event)) return;
    }
  }
}
exports.BidiBrowser = BidiBrowser;
class BidiBrowserContext extends _browserContext.BrowserContext {
  constructor(browser, browserContextId, options) {
    super(browser, options, browserContextId);
    this._authenticateProxyViaHeader();
  }
  _bidiPages() {
    return [...this._browser._bidiPages.values()].filter(bidiPage => bidiPage._browserContext === this);
  }
  possiblyUninitializedPages() {
    return this._bidiPages().map(bidiPage => bidiPage._page);
  }
  async doCreateNewPage() {
    (0, _browserContext.assertBrowserContextIsNotOwned)(this);
    const {
      context
    } = await this._browser._browserSession.send('browsingContext.create', {
      type: bidi.BrowsingContext.CreateType.Window,
      userContext: this._browserContextId
    });
    return this._browser._bidiPages.get(context)._page;
  }
  async doGetCookies(urls) {
    const {
      cookies
    } = await this._browser._browserSession.send('storage.getCookies', {
      partition: {
        type: 'storageKey',
        userContext: this._browserContextId
      }
    });
    return network.filterCookies(cookies.map(c => {
      var _c$expiry;
      const copy = {
        name: c.name,
        value: (0, _bidiNetworkManager.bidiBytesValueToString)(c.value),
        domain: c.domain,
        path: c.path,
        httpOnly: c.httpOnly,
        secure: c.secure,
        expires: (_c$expiry = c.expiry) !== null && _c$expiry !== void 0 ? _c$expiry : -1,
        sameSite: c.sameSite ? fromBidiSameSite(c.sameSite) : 'None'
      };
      return copy;
    }), urls);
  }
  async addCookies(cookies) {
    cookies = network.rewriteCookies(cookies);
    const promises = cookies.map(c => {
      const cookie = {
        name: c.name,
        value: {
          type: 'string',
          value: c.value
        },
        domain: c.domain,
        path: c.path,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite && toBidiSameSite(c.sameSite),
        expiry: c.expires === -1 || c.expires === undefined ? undefined : Math.round(c.expires)
      };
      return this._browser._browserSession.send('storage.setCookie', {
        cookie,
        partition: {
          type: 'storageKey',
          userContext: this._browserContextId
        }
      });
    });
    await Promise.all(promises);
  }
  async doClearCookies() {
    await this._browser._browserSession.send('storage.deleteCookies', {
      partition: {
        type: 'storageKey',
        userContext: this._browserContextId
      }
    });
  }
  async doGrantPermissions(origin, permissions) {}
  async doClearPermissions() {}
  async setGeolocation(geolocation) {}
  async setExtraHTTPHeaders(headers) {}
  async setUserAgent(userAgent) {}
  async setOffline(offline) {}
  async doSetHTTPCredentials(httpCredentials) {
    this._options.httpCredentials = httpCredentials;
    for (const page of this.pages()) await page._delegate.updateHttpCredentials();
  }
  async doAddInitScript(initScript) {
    await Promise.all(this.pages().map(page => page._delegate.addInitScript(initScript)));
  }
  async doRemoveNonInternalInitScripts() {}
  async doUpdateRequestInterception() {}
  onClosePersistent() {}
  async clearCache() {}
  async doClose(reason) {
    if (!this._browserContextId) {
      // Closing persistent context should close the browser.
      await this._browser.close({
        reason
      });
      return;
    }
    await this._browser._browserSession.send('browser.removeUserContext', {
      userContext: this._browserContextId
    });
    this._browser._contexts.delete(this._browserContextId);
  }
  async cancelDownload(uuid) {}
}
exports.BidiBrowserContext = BidiBrowserContext;
function fromBidiSameSite(sameSite) {
  switch (sameSite) {
    case 'strict':
      return 'Strict';
    case 'lax':
      return 'Lax';
    case 'none':
      return 'None';
  }
  return 'None';
}
function toBidiSameSite(sameSite) {
  switch (sameSite) {
    case 'Strict':
      return bidi.Network.SameSite.Strict;
    case 'Lax':
      return bidi.Network.SameSite.Lax;
    case 'None':
      return bidi.Network.SameSite.None;
  }
  return bidi.Network.SameSite.None;
}
let Network = exports.Network = void 0;
(function (_Network) {
  let SameSite = /*#__PURE__*/function (SameSite) {
    SameSite["Strict"] = "strict";
    SameSite["Lax"] = "lax";
    SameSite["None"] = "none";
    return SameSite;
  }({});
  _Network.SameSite = SameSite;
})(Network || (exports.Network = Network = {}));