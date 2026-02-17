"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.GitHubReporter = void 0;
var _path = _interopRequireDefault(require("path"));
var _utils = require("playwright-core/lib/utils");
var _utilsBundle = require("playwright-core/lib/utilsBundle");
var _base = require("./base");
var _util = require("../util");
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

class GitHubLogger {
  _log(message, type = 'notice', options = {}) {
    message = message.replace(/\n/g, '%0A');
    const configs = Object.entries(options).map(([key, option]) => `${key}=${option}`).join(',');
    console.log((0, _util.stripAnsiEscapes)(`::${type} ${configs}::${message}`));
  }
  debug(message, options) {
    this._log(message, 'debug', options);
  }
  error(message, options) {
    this._log(message, 'error', options);
  }
  notice(message, options) {
    this._log(message, 'notice', options);
  }
  warning(message, options) {
    this._log(message, 'warning', options);
  }
}
class GitHubReporter extends _base.TerminalReporter {
  constructor(options = {}) {
    super(options);
    this.githubLogger = new GitHubLogger();
    this.screen = {
      ...this.screen,
      colors: _utils.noColors
    };
  }
  printsToStdio() {
    return false;
  }
  async onEnd(result) {
    await super.onEnd(result);
    this._printAnnotations();
  }
  onError(error) {
    const errorMessage = this.formatError(error).message;
    this.githubLogger.error(errorMessage);
  }
  _printAnnotations() {
    const summary = this.generateSummary();
    const summaryMessage = this.generateSummaryMessage(summary);
    if (summary.failuresToPrint.length) this._printFailureAnnotations(summary.failuresToPrint);
    this._printSlowTestAnnotations();
    this._printSummaryAnnotation(summaryMessage);
  }
  _printSlowTestAnnotations() {
    this.getSlowTests().forEach(([file, duration]) => {
      const filePath = workspaceRelativePath(_path.default.join(process.cwd(), file));
      this.githubLogger.warning(`${filePath} took ${(0, _utilsBundle.ms)(duration)}`, {
        title: 'Slow Test',
        file: filePath
      });
    });
  }
  _printSummaryAnnotation(summary) {
    this.githubLogger.notice(summary, {
      title: '🎭 Playwright Run Summary'
    });
  }
  _printFailureAnnotations(failures) {
    failures.forEach((test, index) => {
      const title = this.formatTestTitle(test);
      const header = this.formatTestHeader(test, {
        indent: '  ',
        index: index + 1,
        mode: 'error'
      });
      for (const result of test.results) {
        const errors = (0, _base.formatResultFailure)(this.screen, test, result, '    ');
        for (const error of errors) {
          var _error$location;
          const options = {
            file: workspaceRelativePath(((_error$location = error.location) === null || _error$location === void 0 ? void 0 : _error$location.file) || test.location.file),
            title
          };
          if (error.location) {
            options.line = error.location.line;
            options.col = error.location.column;
          }
          const message = [header, ...(0, _base.formatRetry)(this.screen, result), error.message].join('\n');
          this.githubLogger.error(message, options);
        }
      }
    });
  }
}
exports.GitHubReporter = GitHubReporter;
function workspaceRelativePath(filePath) {
  var _process$env$GITHUB_W;
  return _path.default.relative((_process$env$GITHUB_W = process.env['GITHUB_WORKSPACE']) !== null && _process$env$GITHUB_W !== void 0 ? _process$env$GITHUB_W : '', filePath);
}
var _default = exports.default = GitHubReporter;