"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports._baseTest = void 0;
Object.defineProperty(exports, "defineConfig", {
  enumerable: true,
  get: function () {
    return _configLoader.defineConfig;
  }
});
Object.defineProperty(exports, "expect", {
  enumerable: true,
  get: function () {
    return _expect.expect;
  }
});
Object.defineProperty(exports, "mergeExpects", {
  enumerable: true,
  get: function () {
    return _expect.mergeExpects;
  }
});
Object.defineProperty(exports, "mergeTests", {
  enumerable: true,
  get: function () {
    return _testType.mergeTests;
  }
});
exports.test = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var playwrightLibrary = _interopRequireWildcard(require("playwright-core"));
var _utils = require("playwright-core/lib/utils");
var _globals = require("./common/globals");
var _testType = require("./common/testType");
var _prompt = require("./prompt");
var _expect = require("./matchers/expect");
var _configLoader = require("./common/configLoader");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
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

const _baseTest = exports._baseTest = _testType.rootTestType.test;
(0, _utils.setBoxedStackPrefixes)([_path.default.dirname(require.resolve('../package.json'))]);
if (process['__pw_initiator__']) {
  const originalStackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 200;
  try {
    throw new Error('Requiring @playwright/test second time, \nFirst:\n' + process['__pw_initiator__'] + '\n\nSecond: ');
  } finally {
    Error.stackTraceLimit = originalStackTraceLimit;
  }
} else {
  process['__pw_initiator__'] = new Error().stack;
}
const playwrightFixtures = {
  defaultBrowserType: ['chromium', {
    scope: 'worker',
    option: true
  }],
  browserName: [({
    defaultBrowserType
  }, use) => use(defaultBrowserType), {
    scope: 'worker',
    option: true
  }],
  playwright: [async ({}, use) => {
    await use(require('playwright-core'));
  }, {
    scope: 'worker',
    box: true
  }],
  headless: [({
    launchOptions
  }, use) => {
    var _launchOptions$headle;
    return use((_launchOptions$headle = launchOptions.headless) !== null && _launchOptions$headle !== void 0 ? _launchOptions$headle : true);
  }, {
    scope: 'worker',
    option: true
  }],
  channel: [({
    launchOptions
  }, use) => use(launchOptions.channel), {
    scope: 'worker',
    option: true
  }],
  launchOptions: [{}, {
    scope: 'worker',
    option: true
  }],
  connectOptions: [async ({
    _optionConnectOptions
  }, use) => {
    await use(connectOptionsFromEnv() || _optionConnectOptions);
  }, {
    scope: 'worker',
    option: true
  }],
  screenshot: ['off', {
    scope: 'worker',
    option: true
  }],
  video: ['off', {
    scope: 'worker',
    option: true
  }],
  trace: ['off', {
    scope: 'worker',
    option: true
  }],
  _browserOptions: [async ({
    playwright,
    headless,
    channel,
    launchOptions
  }, use) => {
    const options = {
      handleSIGINT: false,
      ...launchOptions,
      tracesDir: tracing().tracesDir()
    };
    if (headless !== undefined) options.headless = headless;
    if (channel !== undefined) options.channel = channel;
    playwright._defaultLaunchOptions = options;
    await use(options);
    playwright._defaultLaunchOptions = undefined;
  }, {
    scope: 'worker',
    auto: true,
    box: true
  }],
  browser: [async ({
    playwright,
    browserName,
    _browserOptions,
    connectOptions,
    _reuseContext
  }, use, testInfo) => {
    if (!['chromium', 'firefox', 'webkit', '_bidiChromium', '_bidiFirefox'].includes(browserName)) throw new Error(`Unexpected browserName "${browserName}", must be one of "chromium", "firefox" or "webkit"`);
    if (connectOptions) {
      var _connectOptions$expos;
      const browser = await playwright[browserName].connect({
        ...connectOptions,
        exposeNetwork: (_connectOptions$expos = connectOptions.exposeNetwork) !== null && _connectOptions$expos !== void 0 ? _connectOptions$expos : connectOptions._exposeNetwork,
        headers: {
          ...(_reuseContext ? {
            'x-playwright-reuse-context': '1'
          } : {}),
          // HTTP headers are ASCII only (not UTF-8).
          'x-playwright-launch-options': (0, _utils.jsonStringifyForceASCII)(_browserOptions),
          ...connectOptions.headers
        }
      });
      await use(browser);
      await browser._wrapApiCall(async () => {
        await browser.close({
          reason: 'Test ended.'
        });
      }, true);
      return;
    }
    const browser = await playwright[browserName].launch();
    await use(browser);
    await browser._wrapApiCall(async () => {
      await browser.close({
        reason: 'Test ended.'
      });
    }, true);
  }, {
    scope: 'worker',
    timeout: 0
  }],
  acceptDownloads: [({
    contextOptions
  }, use) => {
    var _contextOptions$accep;
    return use((_contextOptions$accep = contextOptions.acceptDownloads) !== null && _contextOptions$accep !== void 0 ? _contextOptions$accep : true);
  }, {
    option: true
  }],
  bypassCSP: [({
    contextOptions
  }, use) => {
    var _contextOptions$bypas;
    return use((_contextOptions$bypas = contextOptions.bypassCSP) !== null && _contextOptions$bypas !== void 0 ? _contextOptions$bypas : false);
  }, {
    option: true
  }],
  colorScheme: [({
    contextOptions
  }, use) => use(contextOptions.colorScheme === undefined ? 'light' : contextOptions.colorScheme), {
    option: true
  }],
  deviceScaleFactor: [({
    contextOptions
  }, use) => use(contextOptions.deviceScaleFactor), {
    option: true
  }],
  extraHTTPHeaders: [({
    contextOptions
  }, use) => use(contextOptions.extraHTTPHeaders), {
    option: true
  }],
  geolocation: [({
    contextOptions
  }, use) => use(contextOptions.geolocation), {
    option: true
  }],
  hasTouch: [({
    contextOptions
  }, use) => {
    var _contextOptions$hasTo;
    return use((_contextOptions$hasTo = contextOptions.hasTouch) !== null && _contextOptions$hasTo !== void 0 ? _contextOptions$hasTo : false);
  }, {
    option: true
  }],
  httpCredentials: [({
    contextOptions
  }, use) => use(contextOptions.httpCredentials), {
    option: true
  }],
  ignoreHTTPSErrors: [({
    contextOptions
  }, use) => {
    var _contextOptions$ignor;
    return use((_contextOptions$ignor = contextOptions.ignoreHTTPSErrors) !== null && _contextOptions$ignor !== void 0 ? _contextOptions$ignor : false);
  }, {
    option: true
  }],
  isMobile: [({
    contextOptions
  }, use) => {
    var _contextOptions$isMob;
    return use((_contextOptions$isMob = contextOptions.isMobile) !== null && _contextOptions$isMob !== void 0 ? _contextOptions$isMob : false);
  }, {
    option: true
  }],
  javaScriptEnabled: [({
    contextOptions
  }, use) => {
    var _contextOptions$javaS;
    return use((_contextOptions$javaS = contextOptions.javaScriptEnabled) !== null && _contextOptions$javaS !== void 0 ? _contextOptions$javaS : true);
  }, {
    option: true
  }],
  locale: [({
    contextOptions
  }, use) => {
    var _contextOptions$local;
    return use((_contextOptions$local = contextOptions.locale) !== null && _contextOptions$local !== void 0 ? _contextOptions$local : 'en-US');
  }, {
    option: true
  }],
  offline: [({
    contextOptions
  }, use) => {
    var _contextOptions$offli;
    return use((_contextOptions$offli = contextOptions.offline) !== null && _contextOptions$offli !== void 0 ? _contextOptions$offli : false);
  }, {
    option: true
  }],
  permissions: [({
    contextOptions
  }, use) => use(contextOptions.permissions), {
    option: true
  }],
  proxy: [({
    contextOptions
  }, use) => use(contextOptions.proxy), {
    option: true
  }],
  storageState: [({
    contextOptions
  }, use) => use(contextOptions.storageState), {
    option: true
  }],
  clientCertificates: [({
    contextOptions
  }, use) => use(contextOptions.clientCertificates), {
    option: true
  }],
  timezoneId: [({
    contextOptions
  }, use) => use(contextOptions.timezoneId), {
    option: true
  }],
  userAgent: [({
    contextOptions
  }, use) => use(contextOptions.userAgent), {
    option: true
  }],
  viewport: [({
    contextOptions
  }, use) => use(contextOptions.viewport === undefined ? {
    width: 1280,
    height: 720
  } : contextOptions.viewport), {
    option: true
  }],
  actionTimeout: [0, {
    option: true
  }],
  testIdAttribute: ['data-testid', {
    option: true
  }],
  navigationTimeout: [0, {
    option: true
  }],
  baseURL: [async ({}, use) => {
    await use(process.env.PLAYWRIGHT_TEST_BASE_URL);
  }, {
    option: true
  }],
  serviceWorkers: [({
    contextOptions
  }, use) => {
    var _contextOptions$servi;
    return use((_contextOptions$servi = contextOptions.serviceWorkers) !== null && _contextOptions$servi !== void 0 ? _contextOptions$servi : 'allow');
  }, {
    option: true
  }],
  contextOptions: [{}, {
    option: true
  }],
  _combinedContextOptions: [async ({
    acceptDownloads,
    bypassCSP,
    clientCertificates,
    colorScheme,
    deviceScaleFactor,
    extraHTTPHeaders,
    hasTouch,
    geolocation,
    httpCredentials,
    ignoreHTTPSErrors,
    isMobile,
    javaScriptEnabled,
    locale,
    offline,
    permissions,
    proxy,
    storageState,
    viewport,
    timezoneId,
    userAgent,
    baseURL,
    contextOptions,
    serviceWorkers
  }, use) => {
    const options = {};
    if (acceptDownloads !== undefined) options.acceptDownloads = acceptDownloads;
    if (bypassCSP !== undefined) options.bypassCSP = bypassCSP;
    if (colorScheme !== undefined) options.colorScheme = colorScheme;
    if (deviceScaleFactor !== undefined) options.deviceScaleFactor = deviceScaleFactor;
    if (extraHTTPHeaders !== undefined) options.extraHTTPHeaders = extraHTTPHeaders;
    if (geolocation !== undefined) options.geolocation = geolocation;
    if (hasTouch !== undefined) options.hasTouch = hasTouch;
    if (httpCredentials !== undefined) options.httpCredentials = httpCredentials;
    if (ignoreHTTPSErrors !== undefined) options.ignoreHTTPSErrors = ignoreHTTPSErrors;
    if (isMobile !== undefined) options.isMobile = isMobile;
    if (javaScriptEnabled !== undefined) options.javaScriptEnabled = javaScriptEnabled;
    if (locale !== undefined) options.locale = locale;
    if (offline !== undefined) options.offline = offline;
    if (permissions !== undefined) options.permissions = permissions;
    if (proxy !== undefined) options.proxy = proxy;
    if (storageState !== undefined) options.storageState = storageState;
    if (clientCertificates !== null && clientCertificates !== void 0 && clientCertificates.length) options.clientCertificates = resolveClientCerticates(clientCertificates);
    if (timezoneId !== undefined) options.timezoneId = timezoneId;
    if (userAgent !== undefined) options.userAgent = userAgent;
    if (viewport !== undefined) options.viewport = viewport;
    if (baseURL !== undefined) options.baseURL = baseURL;
    if (serviceWorkers !== undefined) options.serviceWorkers = serviceWorkers;
    await use({
      ...contextOptions,
      ...options
    });
  }, {
    box: true
  }],
  _setupContextOptions: [async ({
    playwright,
    _combinedContextOptions,
    actionTimeout,
    navigationTimeout,
    testIdAttribute
  }, use, testInfo) => {
    if (testIdAttribute) playwrightLibrary.selectors.setTestIdAttribute(testIdAttribute);
    testInfo.snapshotSuffix = process.platform;
    if ((0, _utils.debugMode)()) testInfo._setDebugMode();
    playwright._defaultContextOptions = _combinedContextOptions;
    playwright._defaultContextTimeout = actionTimeout || 0;
    playwright._defaultContextNavigationTimeout = navigationTimeout || 0;
    await use();
    playwright._defaultContextOptions = undefined;
    playwright._defaultContextTimeout = undefined;
    playwright._defaultContextNavigationTimeout = undefined;
  }, {
    auto: 'all-hooks-included',
    title: 'context configuration',
    box: true
  }],
  _setupArtifacts: [async ({
    playwright,
    screenshot
  }, use, testInfo) => {
    // This fixture has a separate zero-timeout slot to ensure that artifact collection
    // happens even after some fixtures or hooks time out.
    // Now that default test timeout is known, we can replace zero with an actual value.
    testInfo.setTimeout(testInfo.project.timeout);
    const artifactsRecorder = new ArtifactsRecorder(playwright, tracing().artifactsDir(), screenshot);
    await artifactsRecorder.willStartTest(testInfo);
    const tracingGroupSteps = [];
    const csiListener = {
      onApiCallBegin: data => {
        const testInfo = (0, _globals.currentTestInfo)();
        // Some special calls do not get into steps.
        if (!testInfo || data.apiName.includes('setTestIdAttribute') || data.apiName === 'tracing.groupEnd') return;
        const zone = (0, _utils.currentZone)().data('stepZone');
        if (zone && zone.category === 'expect') {
          // Display the internal locator._expect call under the name of the enclosing expect call,
          // and connect it to the existing expect step.
          data.apiName = zone.title;
          data.stepId = zone.stepId;
          return;
        }
        // In the general case, create a step for each api call and connect them through the stepId.
        const step = testInfo._addStep({
          location: data.frames[0],
          category: 'pw:api',
          title: renderApiCall(data.apiName, data.params),
          apiName: data.apiName,
          params: data.params
        }, tracingGroupSteps[tracingGroupSteps.length - 1]);
        data.userData = step;
        data.stepId = step.stepId;
        if (data.apiName === 'tracing.group') tracingGroupSteps.push(step);
      },
      onApiCallEnd: data => {
        // "tracing.group" step will end later, when "tracing.groupEnd" finishes.
        if (data.apiName === 'tracing.group') return;
        if (data.apiName === 'tracing.groupEnd') {
          const step = tracingGroupSteps.pop();
          step === null || step === void 0 || step.complete({
            error: data.error
          });
          return;
        }
        const step = data.userData;
        step === null || step === void 0 || step.complete({
          error: data.error
        });
      },
      onWillPause: ({
        keepTestTimeout
      }) => {
        var _currentTestInfo;
        if (!keepTestTimeout) (_currentTestInfo = (0, _globals.currentTestInfo)()) === null || _currentTestInfo === void 0 || _currentTestInfo._setDebugMode();
      },
      runAfterCreateBrowserContext: async context => {
        await (artifactsRecorder === null || artifactsRecorder === void 0 ? void 0 : artifactsRecorder.didCreateBrowserContext(context));
        const testInfo = (0, _globals.currentTestInfo)();
        if (testInfo) attachConnectedHeaderIfNeeded(testInfo, context.browser());
      },
      runAfterCreateRequestContext: async context => {
        await (artifactsRecorder === null || artifactsRecorder === void 0 ? void 0 : artifactsRecorder.didCreateRequestContext(context));
      },
      runBeforeCloseBrowserContext: async context => {
        await (artifactsRecorder === null || artifactsRecorder === void 0 ? void 0 : artifactsRecorder.willCloseBrowserContext(context));
      },
      runBeforeCloseRequestContext: async context => {
        await (artifactsRecorder === null || artifactsRecorder === void 0 ? void 0 : artifactsRecorder.willCloseRequestContext(context));
      }
    };
    const clientInstrumentation = playwright._instrumentation;
    clientInstrumentation.addListener(csiListener);
    await use();
    clientInstrumentation.removeListener(csiListener);
    await artifactsRecorder.didFinishTest();
  }, {
    auto: 'all-hooks-included',
    title: 'trace recording',
    box: true,
    timeout: 0
  }],
  _contextFactory: [async ({
    browser,
    video,
    _reuseContext,
    _combinedContextOptions /** mitigate dep-via-auto lack of traceability */
  }, use, testInfo) => {
    const testInfoImpl = testInfo;
    const videoMode = normalizeVideoMode(video);
    const captureVideo = shouldCaptureVideo(videoMode, testInfo) && !_reuseContext;
    const contexts = new Map();
    await use(async options => {
      const hook = testInfoImpl._currentHookType();
      if (hook === 'beforeAll' || hook === 'afterAll') {
        throw new Error([`"context" and "page" fixtures are not supported in "${hook}" since they are created on a per-test basis.`, `If you would like to reuse a single page between tests, create context manually with browser.newContext(). See https://aka.ms/playwright/reuse-page for details.`, `If you would like to configure your page before each test, do that in beforeEach hook instead.`].join('\n'));
      }
      const videoOptions = captureVideo ? {
        recordVideo: {
          dir: tracing().artifactsDir(),
          size: typeof video === 'string' ? undefined : video.size
        }
      } : {};
      const context = await browser.newContext({
        ...videoOptions,
        ...options
      });
      const contextData = {
        pagesWithVideo: []
      };
      contexts.set(context, contextData);
      if (captureVideo) context.on('page', page => contextData.pagesWithVideo.push(page));
      if (process.env.PW_CLOCK === 'frozen') {
        await context._wrapApiCall(async () => {
          await context.clock.install({
            time: 0
          });
          await context.clock.pauseAt(1000);
        }, true);
      } else if (process.env.PW_CLOCK === 'realtime') {
        await context._wrapApiCall(async () => {
          await context.clock.install({
            time: 0
          });
        }, true);
      }
      return context;
    });
    let counter = 0;
    const closeReason = testInfo.status === 'timedOut' ? 'Test timeout of ' + testInfo.timeout + 'ms exceeded.' : 'Test ended.';
    await Promise.all([...contexts.keys()].map(async context => {
      await context._wrapApiCall(async () => {
        await context.close({
          reason: closeReason
        });
      }, true);
      const testFailed = testInfo.status !== testInfo.expectedStatus;
      const preserveVideo = captureVideo && (videoMode === 'on' || testFailed && videoMode === 'retain-on-failure' || videoMode === 'on-first-retry' && testInfo.retry === 1);
      if (preserveVideo) {
        const {
          pagesWithVideo: pagesForVideo
        } = contexts.get(context);
        const videos = pagesForVideo.map(p => p.video()).filter(Boolean);
        await Promise.all(videos.map(async v => {
          try {
            const savedPath = testInfo.outputPath(`video${counter ? '-' + counter : ''}.webm`);
            ++counter;
            await v.saveAs(savedPath);
            testInfo.attachments.push({
              name: 'video',
              path: savedPath,
              contentType: 'video/webm'
            });
          } catch (e) {
            // Silent catch empty videos.
          }
        }));
      }
    }));
  }, {
    scope: 'test',
    title: 'context',
    box: true
  }],
  _optionContextReuseMode: ['none', {
    scope: 'worker',
    option: true
  }],
  _optionConnectOptions: [undefined, {
    scope: 'worker',
    option: true
  }],
  _reuseContext: [async ({
    video,
    _optionContextReuseMode
  }, use) => {
    let mode = _optionContextReuseMode;
    if (process.env.PW_TEST_REUSE_CONTEXT) mode = 'when-possible';
    const reuse = mode === 'when-possible' && normalizeVideoMode(video) === 'off';
    await use(reuse);
  }, {
    scope: 'worker',
    title: 'context',
    box: true
  }],
  context: async ({
    playwright,
    browser,
    _reuseContext,
    _contextFactory
  }, use, testInfo) => {
    attachConnectedHeaderIfNeeded(testInfo, browser);
    if (!_reuseContext) {
      await use(await _contextFactory());
      return;
    }
    const defaultContextOptions = playwright.chromium._defaultContextOptions;
    const context = await browser._newContextForReuse(defaultContextOptions);
    context[kIsReusedContext] = true;
    await use(context);
    const closeReason = testInfo.status === 'timedOut' ? 'Test timeout of ' + testInfo.timeout + 'ms exceeded.' : 'Test ended.';
    await browser._stopPendingOperations(closeReason);
  },
  page: async ({
    context,
    _reuseContext
  }, use) => {
    if (!_reuseContext) {
      await use(await context.newPage());
      return;
    }

    // First time we are reusing the context, we should create the page.
    let [page] = context.pages();
    if (!page) page = await context.newPage();
    await use(page);
  },
  request: async ({
    playwright
  }, use) => {
    const request = await playwright.request.newContext();
    await use(request);
    const hook = test.info()._currentHookType();
    if (hook === 'beforeAll') {
      await request.dispose({
        reason: [`Fixture { request } from beforeAll cannot be reused in a test.`, `  - Recommended fix: use a separate { request } in the test.`, `  - Alternatively, manually create APIRequestContext in beforeAll and dispose it in afterAll.`, `See https://playwright.dev/docs/api-testing#sending-api-requests-from-ui-tests for more details.`].join('\n')
      });
    } else {
      await request.dispose();
    }
  }
};
function normalizeVideoMode(video) {
  if (!video) return 'off';
  let videoMode = typeof video === 'string' ? video : video.mode;
  if (videoMode === 'retry-with-video') videoMode = 'on-first-retry';
  return videoMode;
}
function shouldCaptureVideo(videoMode, testInfo) {
  return videoMode === 'on' || videoMode === 'retain-on-failure' || videoMode === 'on-first-retry' && testInfo.retry === 1;
}
function normalizeScreenshotMode(screenshot) {
  if (!screenshot) return 'off';
  return typeof screenshot === 'string' ? screenshot : screenshot.mode;
}
function attachConnectedHeaderIfNeeded(testInfo, browser) {
  const connectHeaders = browser === null || browser === void 0 ? void 0 : browser._connection.headers;
  if (!connectHeaders) return;
  for (const header of connectHeaders) {
    if (header.name !== 'x-playwright-attachment') continue;
    const [name, value] = header.value.split('=');
    if (!name || !value) continue;
    if (testInfo.attachments.some(attachment => attachment.name === name)) continue;
    testInfo.attachments.push({
      name,
      contentType: 'text/plain',
      body: Buffer.from(value)
    });
  }
}
function resolveFileToConfig(file) {
  const config = test.info().config.configFile;
  if (!config || !file) return file;
  if (_path.default.isAbsolute(file)) return file;
  return _path.default.resolve(_path.default.dirname(config), file);
}
function resolveClientCerticates(clientCertificates) {
  for (const cert of clientCertificates) {
    cert.certPath = resolveFileToConfig(cert.certPath);
    cert.keyPath = resolveFileToConfig(cert.keyPath);
    cert.pfxPath = resolveFileToConfig(cert.pfxPath);
  }
  return clientCertificates;
}
const kTracingStarted = Symbol('kTracingStarted');
const kIsReusedContext = Symbol('kReusedContext');
function connectOptionsFromEnv() {
  const wsEndpoint = process.env.PW_TEST_CONNECT_WS_ENDPOINT;
  if (!wsEndpoint) return undefined;
  const headers = process.env.PW_TEST_CONNECT_HEADERS ? JSON.parse(process.env.PW_TEST_CONNECT_HEADERS) : undefined;
  return {
    wsEndpoint,
    headers,
    exposeNetwork: process.env.PW_TEST_CONNECT_EXPOSE_NETWORK
  };
}
class SnapshotRecorder {
  constructor(_artifactsRecorder, _mode, _name, _contentType, _extension, _doSnapshot) {
    this._ordinal = 0;
    this._temporary = [];
    this._snapshottedSymbol = Symbol('snapshotted');
    this._artifactsRecorder = _artifactsRecorder;
    this._mode = _mode;
    this._name = _name;
    this._contentType = _contentType;
    this._extension = _extension;
    this._doSnapshot = _doSnapshot;
  }
  fixOrdinal() {
    // Since beforeAll(s), test and afterAll(s) reuse the same TestInfo, make sure we do not
    // overwrite previous screenshots.
    this._ordinal = this.testInfo.attachments.filter(a => a.name === this._name).length;
  }
  shouldCaptureUponFinish() {
    return this._mode === 'on' || this._mode === 'only-on-failure' && this.testInfo._isFailure() || this._mode === 'on-first-failure' && this.testInfo._isFailure() && this.testInfo.retry === 0;
  }
  async maybeCapture() {
    if (!this.shouldCaptureUponFinish()) return;
    await Promise.all(this._artifactsRecorder._playwright._allPages().map(page => this._snapshotPage(page, false)));
  }
  async persistTemporary() {
    if (this.shouldCaptureUponFinish()) {
      await Promise.all(this._temporary.map(async file => {
        try {
          const path = this._createAttachmentPath();
          await _fs.default.promises.rename(file, path);
          this._attach(path);
        } catch {}
      }));
    }
  }
  async captureTemporary(context) {
    if (this._mode === 'on' || this._mode === 'only-on-failure' || this._mode === 'on-first-failure' && this.testInfo.retry === 0) await Promise.all(context.pages().map(page => this._snapshotPage(page, true)));
  }
  _attach(screenshotPath) {
    this.testInfo.attachments.push({
      name: this._name,
      path: screenshotPath,
      contentType: this._contentType
    });
  }
  _createAttachmentPath() {
    const testFailed = this.testInfo._isFailure();
    const index = this._ordinal + 1;
    ++this._ordinal;
    const path = this.testInfo.outputPath(`test-${testFailed ? 'failed' : 'finished'}-${index}${this._extension}`);
    return path;
  }
  _createTemporaryArtifact(...name) {
    const file = _path.default.join(this._artifactsRecorder._artifactsDir, ...name);
    return file;
  }
  async _snapshotPage(page, temporary) {
    if (page[this._snapshottedSymbol]) return;
    page[this._snapshottedSymbol] = true;
    try {
      const path = temporary ? this._createTemporaryArtifact((0, _utils.createGuid)() + this._extension) : this._createAttachmentPath();
      await this._doSnapshot(page, path);
      if (temporary) this._temporary.push(path);else this._attach(path);
    } catch {
      // snapshot may fail, just ignore.
    }
  }
  get testInfo() {
    return this._artifactsRecorder._testInfo;
  }
}
class ArtifactsRecorder {
  constructor(playwright, artifactsDir, screenshot) {
    this._testInfo = void 0;
    this._playwright = void 0;
    this._artifactsDir = void 0;
    this._reusedContexts = new Set();
    this._startedCollectingArtifacts = void 0;
    this._screenshotRecorder = void 0;
    this._pageSnapshot = void 0;
    this._sourceCache = new Map();
    this._playwright = playwright;
    this._artifactsDir = artifactsDir;
    const screenshotOptions = typeof screenshot === 'string' ? undefined : screenshot;
    this._startedCollectingArtifacts = Symbol('startedCollectingArtifacts');
    this._screenshotRecorder = new SnapshotRecorder(this, normalizeScreenshotMode(screenshot), 'screenshot', 'image/png', '.png', async (page, path) => {
      await page.screenshot({
        ...screenshotOptions,
        timeout: 5000,
        path,
        caret: 'initial'
      });
    });
  }
  async willStartTest(testInfo) {
    this._testInfo = testInfo;
    testInfo._onDidFinishTestFunction = () => this.didFinishTestFunction();
    this._screenshotRecorder.fixOrdinal();

    // Process existing contexts.
    await Promise.all(this._playwright._allContexts().map(async context => {
      if (context[kIsReusedContext]) this._reusedContexts.add(context);else await this.didCreateBrowserContext(context);
    }));
    {
      const existingApiRequests = Array.from(this._playwright.request._contexts);
      await Promise.all(existingApiRequests.map(c => this.didCreateRequestContext(c)));
    }
  }
  async didCreateBrowserContext(context) {
    await this._startTraceChunkOnContextCreation(context.tracing);
  }
  async willCloseBrowserContext(context) {
    // When reusing context, we get all previous contexts closed at the start of next test.
    // Do not record empty traces and useless screenshots for them.
    if (this._reusedContexts.has(context)) return;
    await this._stopTracing(context.tracing);
    await this._screenshotRecorder.captureTemporary(context);
    if (!process.env.PLAYWRIGHT_NO_COPY_PROMPT && this._testInfo.errors.length > 0) {
      try {
        var _this$_pageSnapshot;
        const page = context.pages()[0];
        // TODO: maybe capture snapshot when the error is created, so it's from the right page and right time
        (_this$_pageSnapshot = this._pageSnapshot) !== null && _this$_pageSnapshot !== void 0 ? _this$_pageSnapshot : this._pageSnapshot = await (page === null || page === void 0 ? void 0 : page.locator('body').ariaSnapshot({
          timeout: 5000
        }));
      } catch {}
    }
  }
  async didCreateRequestContext(context) {
    const tracing = context._tracing;
    await this._startTraceChunkOnContextCreation(tracing);
  }
  async willCloseRequestContext(context) {
    const tracing = context._tracing;
    await this._stopTracing(tracing);
  }
  async didFinishTestFunction() {
    await this._screenshotRecorder.maybeCapture();
  }
  async didFinishTest() {
    await this.didFinishTestFunction();
    const leftoverContexts = this._playwright._allContexts().filter(context => !this._reusedContexts.has(context));
    const leftoverApiRequests = Array.from(this._playwright.request._contexts);

    // Collect traces/screenshots for remaining contexts.
    await Promise.all(leftoverContexts.map(async context => {
      await this._stopTracing(context.tracing);
    }).concat(leftoverApiRequests.map(async context => {
      const tracing = context._tracing;
      await this._stopTracing(tracing);
    })));
    await this._screenshotRecorder.persistTemporary();
    await (0, _prompt.attachErrorPrompts)(this._testInfo, this._sourceCache, this._pageSnapshot);
  }
  async _startTraceChunkOnContextCreation(tracing) {
    const options = this._testInfo._tracing.traceOptions();
    if (options) {
      const title = this._testInfo._tracing.traceTitle();
      const name = this._testInfo._tracing.generateNextTraceRecordingName();
      if (!tracing[kTracingStarted]) {
        await tracing.start({
          ...options,
          title,
          name
        });
        tracing[kTracingStarted] = true;
      } else {
        await tracing.startChunk({
          title,
          name
        });
      }
    } else {
      if (tracing[kTracingStarted]) {
        tracing[kTracingStarted] = false;
        await tracing.stop();
      }
    }
  }
  async _stopTracing(tracing) {
    if (tracing[this._startedCollectingArtifacts]) return;
    tracing[this._startedCollectingArtifacts] = true;
    if (this._testInfo._tracing.traceOptions() && tracing[kTracingStarted]) await tracing.stopChunk({
      path: this._testInfo._tracing.maybeGenerateNextTraceRecordingPath()
    });
  }
}
const paramsToRender = ['url', 'selector', 'text', 'key'];
function renderApiCall(apiName, params) {
  if (apiName === 'tracing.group') return params.name;
  const paramsArray = [];
  if (params) {
    for (const name of paramsToRender) {
      if (!(name in params)) continue;
      let value;
      if (name === 'selector' && (0, _utils.isString)(params[name]) && params[name].startsWith('internal:')) {
        const getter = (0, _utils.asLocator)('javascript', params[name]);
        apiName = apiName.replace(/^locator\./, 'locator.' + getter + '.');
        apiName = apiName.replace(/^page\./, 'page.' + getter + '.');
        apiName = apiName.replace(/^frame\./, 'frame.' + getter + '.');
      } else {
        value = params[name];
        paramsArray.push(value);
      }
    }
  }
  const paramsText = paramsArray.length ? '(' + paramsArray.join(', ') + ')' : '';
  return apiName + paramsText;
}
function tracing() {
  return test.info()._tracing;
}
const test = exports.test = _baseTest.extend(playwrightFixtures);