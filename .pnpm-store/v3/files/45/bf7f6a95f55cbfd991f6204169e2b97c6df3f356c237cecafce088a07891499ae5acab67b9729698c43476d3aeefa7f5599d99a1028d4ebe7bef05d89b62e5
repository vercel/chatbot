"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.webServerPluginsForConfig = exports.webServer = exports.WebServerPlugin = void 0;
var _net = _interopRequireDefault(require("net"));
var _path = _interopRequireDefault(require("path"));
var _utils = require("playwright-core/lib/utils");
var _utilsBundle = require("playwright-core/lib/utilsBundle");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
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

const DEFAULT_ENVIRONMENT_VARIABLES = {
  'BROWSER': 'none',
  // Disable that create-react-app will open the page in the browser
  'FORCE_COLOR': '1',
  'DEBUG_COLORS': '1'
};
const debugWebServer = (0, _utilsBundle.debug)('pw:webserver');
class WebServerPlugin {
  constructor(options, checkPortOnly) {
    this._isAvailableCallback = void 0;
    this._killProcess = void 0;
    this._processExitedPromise = void 0;
    this._options = void 0;
    this._checkPortOnly = void 0;
    this._reporter = void 0;
    this.name = 'playwright:webserver';
    this._options = options;
    this._checkPortOnly = checkPortOnly;
  }
  async setup(config, configDir, reporter) {
    var _this$_reporter$onStd;
    this._reporter = reporter;
    this._isAvailableCallback = this._options.url ? getIsAvailableFunction(this._options.url, this._checkPortOnly, !!this._options.ignoreHTTPSErrors, (_this$_reporter$onStd = this._reporter.onStdErr) === null || _this$_reporter$onStd === void 0 ? void 0 : _this$_reporter$onStd.bind(this._reporter)) : undefined;
    this._options.cwd = this._options.cwd ? _path.default.resolve(configDir, this._options.cwd) : configDir;
    try {
      await this._startProcess();
      await this._waitForProcess();
    } catch (error) {
      await this.teardown();
      throw error;
    }
  }
  async teardown() {
    var _this$_killProcess;
    debugWebServer(`Terminating the WebServer`);
    await ((_this$_killProcess = this._killProcess) === null || _this$_killProcess === void 0 ? void 0 : _this$_killProcess.call(this));
    debugWebServer(`Terminated the WebServer`);
  }
  async _startProcess() {
    var _this$_isAvailableCal;
    let processExitedReject = error => {};
    this._processExitedPromise = new Promise((_, reject) => processExitedReject = reject);
    const isAlreadyAvailable = await ((_this$_isAvailableCal = this._isAvailableCallback) === null || _this$_isAvailableCal === void 0 ? void 0 : _this$_isAvailableCal.call(this));
    if (isAlreadyAvailable) {
      var _this$_options$url;
      debugWebServer(`WebServer is already available`);
      if (this._options.reuseExistingServer) return;
      const port = new URL(this._options.url).port;
      throw new Error(`${(_this$_options$url = this._options.url) !== null && _this$_options$url !== void 0 ? _this$_options$url : `http://localhost${port ? ':' + port : ''}`} is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true in config.webServer.`);
    }
    debugWebServer(`Starting WebServer process ${this._options.command}...`);
    const {
      launchedProcess,
      gracefullyClose
    } = await (0, _utils.launchProcess)({
      command: this._options.command,
      env: {
        ...DEFAULT_ENVIRONMENT_VARIABLES,
        ...process.env,
        ...this._options.env
      },
      cwd: this._options.cwd,
      stdio: 'stdin',
      shell: true,
      attemptToGracefullyClose: async () => {
        if (process.platform === 'win32') throw new Error('Graceful shutdown is not supported on Windows');
        if (!this._options.gracefulShutdown) throw new Error('skip graceful shutdown');
        const {
          signal,
          timeout = 0
        } = this._options.gracefulShutdown;

        // proper usage of SIGINT is to send it to the entire process group, see https://www.cons.org/cracauer/sigint.html
        // there's no such convention for SIGTERM, so we decide what we want. signaling the process group for consistency.
        process.kill(-launchedProcess.pid, signal);
        return new Promise((resolve, reject) => {
          const timer = timeout !== 0 ? setTimeout(() => reject(new Error(`process didn't close gracefully within timeout`)), timeout) : undefined;
          launchedProcess.once('close', (...args) => {
            clearTimeout(timer);
            resolve();
          });
        });
      },
      log: () => {},
      onExit: code => processExitedReject(new Error(code ? `Process from config.webServer was not able to start. Exit code: ${code}` : 'Process from config.webServer exited early.')),
      tempDirectories: []
    });
    this._killProcess = gracefullyClose;
    debugWebServer(`Process started`);
    launchedProcess.stderr.on('data', data => {
      var _onStdErr, _ref;
      if (debugWebServer.enabled || this._options.stderr === 'pipe' || !this._options.stderr) (_onStdErr = (_ref = this._reporter).onStdErr) === null || _onStdErr === void 0 || _onStdErr.call(_ref, prefixOutputLines(data.toString()));
    });
    launchedProcess.stdout.on('data', data => {
      var _onStdOut, _ref2;
      if (debugWebServer.enabled || this._options.stdout === 'pipe') (_onStdOut = (_ref2 = this._reporter).onStdOut) === null || _onStdOut === void 0 || _onStdOut.call(_ref2, prefixOutputLines(data.toString()));
    });
  }
  async _waitForProcess() {
    if (!this._isAvailableCallback) {
      this._processExitedPromise.catch(() => {});
      return;
    }
    debugWebServer(`Waiting for availability...`);
    const launchTimeout = this._options.timeout || 60 * 1000;
    const cancellationToken = {
      canceled: false
    };
    const {
      timedOut
    } = await Promise.race([(0, _utils.raceAgainstDeadline)(() => waitFor(this._isAvailableCallback, cancellationToken), (0, _utils.monotonicTime)() + launchTimeout), this._processExitedPromise]);
    cancellationToken.canceled = true;
    if (timedOut) throw new Error(`Timed out waiting ${launchTimeout}ms from config.webServer.`);
    debugWebServer(`WebServer available`);
  }
}
exports.WebServerPlugin = WebServerPlugin;
async function isPortUsed(port) {
  const innerIsPortUsed = host => new Promise(resolve => {
    const conn = _net.default.connect(port, host).on('error', () => {
      resolve(false);
    }).on('connect', () => {
      conn.end();
      resolve(true);
    });
  });
  return (await innerIsPortUsed('127.0.0.1')) || (await innerIsPortUsed('::1'));
}
async function waitFor(waitFn, cancellationToken) {
  const logScale = [100, 250, 500];
  while (!cancellationToken.canceled) {
    const connected = await waitFn();
    if (connected) return;
    const delay = logScale.shift() || 1000;
    debugWebServer(`Waiting ${delay}ms`);
    await new Promise(x => setTimeout(x, delay));
  }
}
function getIsAvailableFunction(url, checkPortOnly, ignoreHTTPSErrors, onStdErr) {
  const urlObject = new URL(url);
  if (!checkPortOnly) return () => (0, _utils.isURLAvailable)(urlObject, ignoreHTTPSErrors, debugWebServer, onStdErr);
  const port = urlObject.port;
  return () => isPortUsed(+port);
}
const webServer = options => {
  return new WebServerPlugin(options, false);
};
exports.webServer = webServer;
const webServerPluginsForConfig = config => {
  const shouldSetBaseUrl = !!config.config.webServer;
  const webServerPlugins = [];
  for (const webServerConfig of config.webServers) {
    if (webServerConfig.port && webServerConfig.url) throw new Error(`Either 'port' or 'url' should be specified in config.webServer.`);
    let url;
    if (webServerConfig.port || webServerConfig.url) {
      url = webServerConfig.url || `http://localhost:${webServerConfig.port}`;

      // We only set base url when only the port is given. That's a legacy mode we have regrets about.
      if (shouldSetBaseUrl && !webServerConfig.url) process.env.PLAYWRIGHT_TEST_BASE_URL = url;
    }
    webServerPlugins.push(new WebServerPlugin({
      ...webServerConfig,
      url
    }, webServerConfig.port !== undefined));
  }
  return webServerPlugins;
};
exports.webServerPluginsForConfig = webServerPluginsForConfig;
function prefixOutputLines(output) {
  const lastIsNewLine = output[output.length - 1] === '\n';
  let lines = output.split('\n');
  if (lastIsNewLine) lines.pop();
  lines = lines.map(line => _utils.colors.dim('[WebServer] ') + line);
  if (lastIsNewLine) lines.push('');
  return lines.join('\n');
}