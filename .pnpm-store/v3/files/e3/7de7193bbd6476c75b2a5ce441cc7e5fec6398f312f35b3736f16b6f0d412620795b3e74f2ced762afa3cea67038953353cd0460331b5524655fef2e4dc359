"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.BidiChromium = void 0;
var _os = _interopRequireDefault(require("os"));
var _utils = require("../../utils");
var _ascii = require("../utils/ascii");
var _browserType = require("../browserType");
var _bidiBrowser = require("./bidiBrowser");
var _bidiConnection = require("./bidiConnection");
var _chromiumSwitches = require("../chromium/chromiumSwitches");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
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

class BidiChromium extends _browserType.BrowserType {
  constructor(parent) {
    super(parent, 'bidi');
    this._useBidi = true;
  }
  async connectToTransport(transport, options) {
    // Chrome doesn't support Bidi, we create Bidi over CDP which is used by Chrome driver.
    // bidiOverCdp depends on chromium-bidi which we only have in devDependencies, so
    // we load bidiOverCdp dynamically.
    const bidiTransport = await require('./bidiOverCdp').connectBidiOverCdp(transport);
    transport[kBidiOverCdpWrapper] = bidiTransport;
    return _bidiBrowser.BidiBrowser.connect(this.attribution.playwright, bidiTransport, options);
  }
  doRewriteStartupLog(error) {
    if (!error.logs) return error;
    if (error.logs.includes('Missing X server')) error.logs = '\n' + (0, _ascii.wrapInASCIIBox)(_browserType.kNoXServerRunningError, 1);
    // These error messages are taken from Chromium source code as of July, 2020:
    // https://github.com/chromium/chromium/blob/70565f67e79f79e17663ad1337dc6e63ee207ce9/content/browser/zygote_host/zygote_host_impl_linux.cc
    if (!error.logs.includes('crbug.com/357670') && !error.logs.includes('No usable sandbox!') && !error.logs.includes('crbug.com/638180')) return error;
    error.logs = [`Chromium sandboxing failed!`, `================================`, `To avoid the sandboxing issue, do either of the following:`, `  - (preferred): Configure your environment to support sandboxing`, `  - (alternative): Launch Chromium without sandbox using 'chromiumSandbox: false' option`, `================================`, ``].join('\n');
    return error;
  }
  amendEnvironment(env, userDataDir, executable, browserArguments) {
    return env;
  }
  attemptToGracefullyCloseBrowser(transport) {
    const bidiTransport = transport[kBidiOverCdpWrapper];
    if (bidiTransport) transport = bidiTransport;
    transport.send({
      method: 'browser.close',
      params: {},
      id: _bidiConnection.kBrowserCloseMessageId
    });
  }
  defaultArgs(options, isPersistent, userDataDir) {
    const chromeArguments = this._innerDefaultArgs(options);
    chromeArguments.push(`--user-data-dir=${userDataDir}`);
    chromeArguments.push('--remote-debugging-port=0');
    if (isPersistent) chromeArguments.push('about:blank');else chromeArguments.push('--no-startup-window');
    return chromeArguments;
  }
  readyState(options) {
    (0, _utils.assert)(options.useWebSocket);
    return new ChromiumReadyState();
  }
  _innerDefaultArgs(options) {
    const {
      args = []
    } = options;
    const userDataDirArg = args.find(arg => arg.startsWith('--user-data-dir'));
    if (userDataDirArg) throw this._createUserDataDirArgMisuseError('--user-data-dir');
    if (args.find(arg => arg.startsWith('--remote-debugging-pipe'))) throw new Error('Playwright manages remote debugging connection itself.');
    if (args.find(arg => !arg.startsWith('-'))) throw new Error('Arguments can not specify page to be opened');
    const chromeArguments = [..._chromiumSwitches.chromiumSwitches];
    if (_os.default.platform() === 'darwin') {
      // See https://github.com/microsoft/playwright/issues/7362
      chromeArguments.push('--enable-use-zoom-for-dsf=false');
      // See https://bugs.chromium.org/p/chromium/issues/detail?id=1407025.
      if (options.headless) chromeArguments.push('--use-angle');
    }
    if (options.devtools) chromeArguments.push('--auto-open-devtools-for-tabs');
    if (options.headless) {
      chromeArguments.push('--headless');
      chromeArguments.push('--hide-scrollbars', '--mute-audio', '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4');
    }
    if (options.chromiumSandbox !== true) chromeArguments.push('--no-sandbox');
    const proxy = options.proxyOverride || options.proxy;
    if (proxy) {
      const proxyURL = new URL(proxy.server);
      const isSocks = proxyURL.protocol === 'socks5:';
      // https://www.chromium.org/developers/design-documents/network-settings
      if (isSocks && !this.attribution.playwright.options.socksProxyPort) {
        // https://www.chromium.org/developers/design-documents/network-stack/socks-proxy
        chromeArguments.push(`--host-resolver-rules="MAP * ~NOTFOUND , EXCLUDE ${proxyURL.hostname}"`);
      }
      chromeArguments.push(`--proxy-server=${proxy.server}`);
      const proxyBypassRules = [];
      // https://source.chromium.org/chromium/chromium/src/+/master:net/docs/proxy.md;l=548;drc=71698e610121078e0d1a811054dcf9fd89b49578
      if (this.attribution.playwright.options.socksProxyPort) proxyBypassRules.push('<-loopback>');
      if (proxy.bypass) proxyBypassRules.push(...proxy.bypass.split(',').map(t => t.trim()).map(t => t.startsWith('.') ? '*' + t : t));
      if (!process.env.PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK && !proxyBypassRules.includes('<-loopback>')) proxyBypassRules.push('<-loopback>');
      if (proxyBypassRules.length > 0) chromeArguments.push(`--proxy-bypass-list=${proxyBypassRules.join(';')}`);
    }
    chromeArguments.push(...args);
    return chromeArguments;
  }
}
exports.BidiChromium = BidiChromium;
class ChromiumReadyState extends _browserType.BrowserReadyState {
  onBrowserOutput(message) {
    const match = message.match(/DevTools listening on (.*)/);
    if (match) this._wsEndpoint.resolve(match[1]);
  }
}
const kBidiOverCdpWrapper = Symbol('kBidiConnectionWrapper');