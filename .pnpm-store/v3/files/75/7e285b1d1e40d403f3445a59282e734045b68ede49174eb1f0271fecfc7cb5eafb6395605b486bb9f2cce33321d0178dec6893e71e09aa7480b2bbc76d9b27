"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Firefox = void 0;
var _os = _interopRequireDefault(require("os"));
var _path = _interopRequireDefault(require("path"));
var _ffBrowser = require("./ffBrowser");
var _ffConnection = require("./ffConnection");
var _ascii = require("../utils/ascii");
var _browserType = require("../browserType");
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

class Firefox extends _browserType.BrowserType {
  constructor(parent) {
    super(parent, 'firefox');
  }
  connectToTransport(transport, options) {
    return _ffBrowser.FFBrowser.connect(this.attribution.playwright, transport, options);
  }
  doRewriteStartupLog(error) {
    if (!error.logs) return error;
    // https://github.com/microsoft/playwright/issues/6500
    if (error.logs.includes(`as root in a regular user's session is not supported.`)) error.logs = '\n' + (0, _ascii.wrapInASCIIBox)(`Firefox is unable to launch if the $HOME folder isn't owned by the current user.\nWorkaround: Set the HOME=/root environment variable${process.env.GITHUB_ACTION ? ' in your GitHub Actions workflow file' : ''} when running Playwright.`, 1);
    if (error.logs.includes('no DISPLAY environment variable specified')) error.logs = '\n' + (0, _ascii.wrapInASCIIBox)(_browserType.kNoXServerRunningError, 1);
    return error;
  }
  amendEnvironment(env, userDataDir, executable, browserArguments) {
    if (!_path.default.isAbsolute(_os.default.homedir())) throw new Error(`Cannot launch Firefox with relative home directory. Did you set ${_os.default.platform() === 'win32' ? 'USERPROFILE' : 'HOME'} to a relative path?`);
    if (_os.default.platform() === 'linux') {
      // Always remove SNAP_NAME and SNAP_INSTANCE_NAME env variables since they
      // confuse Firefox: in our case, builds never come from SNAP.
      // See https://github.com/microsoft/playwright/issues/20555
      return {
        ...env,
        SNAP_NAME: undefined,
        SNAP_INSTANCE_NAME: undefined
      };
    }
    return env;
  }
  attemptToGracefullyCloseBrowser(transport) {
    const message = {
      method: 'Browser.close',
      params: {},
      id: _ffConnection.kBrowserCloseMessageId
    };
    transport.send(message);
  }
  defaultArgs(options, isPersistent, userDataDir) {
    const {
      args = [],
      headless
    } = options;
    const userDataDirArg = args.find(arg => arg.startsWith('-profile') || arg.startsWith('--profile'));
    if (userDataDirArg) throw this._createUserDataDirArgMisuseError('--profile');
    if (args.find(arg => arg.startsWith('-juggler'))) throw new Error('Use the port parameter instead of -juggler argument');
    const firefoxArguments = ['-no-remote'];
    if (headless) {
      firefoxArguments.push('-headless');
    } else {
      firefoxArguments.push('-wait-for-browser');
      firefoxArguments.push('-foreground');
    }
    firefoxArguments.push(`-profile`, userDataDir);
    firefoxArguments.push('-juggler-pipe');
    firefoxArguments.push(...args);
    if (isPersistent) firefoxArguments.push('about:blank');else firefoxArguments.push('-silent');
    return firefoxArguments;
  }
  readyState(options) {
    return new JugglerReadyState();
  }
}
exports.Firefox = Firefox;
class JugglerReadyState extends _browserType.BrowserReadyState {
  onBrowserOutput(message) {
    if (message.includes('Juggler listening to the pipe')) this._wsEndpoint.resolve(undefined);
  }
}