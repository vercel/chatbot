"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LastRunReporter = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _projectUtils = require("./projectUtils");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
/**
 * Copyright Microsoft Corporation. All rights reserved.
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

class LastRunReporter {
  constructor(config) {
    this._config = void 0;
    this._lastRunFile = void 0;
    this._suite = void 0;
    this._config = config;
    const [project] = (0, _projectUtils.filterProjects)(config.projects, config.cliProjectFilter);
    if (project) this._lastRunFile = _path.default.join(project.project.outputDir, '.last-run.json');
  }
  async filterLastFailed() {
    if (!this._lastRunFile) return;
    try {
      const lastRunInfo = JSON.parse(await _fs.default.promises.readFile(this._lastRunFile, 'utf8'));
      this._config.lastFailedTestIdMatcher = id => lastRunInfo.failedTests.includes(id);
    } catch {}
  }
  version() {
    return 'v2';
  }
  printsToStdio() {
    return false;
  }
  onBegin(suite) {
    this._suite = suite;
  }
  async onEnd(result) {
    var _this$_suite;
    if (!this._lastRunFile || this._config.cliListOnly) return;
    await _fs.default.promises.mkdir(_path.default.dirname(this._lastRunFile), {
      recursive: true
    });
    const failedTests = (_this$_suite = this._suite) === null || _this$_suite === void 0 ? void 0 : _this$_suite.allTests().filter(t => !t.ok()).map(t => t.id);
    const lastRunReport = JSON.stringify({
      status: result.status,
      failedTests
    }, undefined, 2);
    await _fs.default.promises.writeFile(this._lastRunFile, lastRunReport);
  }
}
exports.LastRunReporter = LastRunReporter;