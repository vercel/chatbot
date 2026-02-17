"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TeleSuiteUpdater = void 0;
var _teleReceiver = require("./teleReceiver");
var _testTree = require("./testTree");
/**
 * Copyright (c) Microsoft Corporation.
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

class TeleSuiteUpdater {
  constructor(options) {
    this.rootSuite = void 0;
    this.config = void 0;
    this.loadErrors = [];
    this.progress = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };
    this._receiver = void 0;
    this._lastRunReceiver = void 0;
    this._lastRunTestCount = 0;
    this._options = void 0;
    this._testResultsSnapshot = void 0;
    this._receiver = new _teleReceiver.TeleReporterReceiver(this._createReporter(), {
      mergeProjects: true,
      mergeTestCases: true,
      resolvePath: (rootDir, relativePath) => rootDir + options.pathSeparator + relativePath,
      clearPreviousResultsWhenTestBegins: true
    });
    this._options = options;
  }
  _createReporter() {
    return {
      version: () => 'v2',
      onConfigure: c => {
        this.config = c;
        // TeleReportReceiver is merging everything into a single suite, so when we
        // run one test, we still get many tests via rootSuite.allTests().length.
        // To work around that, have a dedicated per-run receiver that will only have
        // suite for a single test run, and hence will have correct total.
        this._lastRunReceiver = new _teleReceiver.TeleReporterReceiver({
          version: () => 'v2',
          onBegin: suite => {
            this._lastRunTestCount = suite.allTests().length;
            this._lastRunReceiver = undefined;
          }
        }, {
          mergeProjects: true,
          mergeTestCases: false,
          resolvePath: (rootDir, relativePath) => rootDir + this._options.pathSeparator + relativePath
        });
      },
      onBegin: suite => {
        if (!this.rootSuite) this.rootSuite = suite;
        // As soon as new test tree is built add previous results, before calling onUpdate
        // to avoid flashing empty results in the UI.
        if (this._testResultsSnapshot) {
          for (const test of this.rootSuite.allTests()) {
            var _this$_testResultsSna;
            test.results = ((_this$_testResultsSna = this._testResultsSnapshot) === null || _this$_testResultsSna === void 0 ? void 0 : _this$_testResultsSna.get(test.id)) || test.results;
          }
          this._testResultsSnapshot = undefined;
        }
        this.progress.total = this._lastRunTestCount;
        this.progress.passed = 0;
        this.progress.failed = 0;
        this.progress.skipped = 0;
        this._options.onUpdate(true);
      },
      onEnd: () => {
        this._options.onUpdate(true);
      },
      onTestBegin: (test, testResult) => {
        testResult[_testTree.statusEx] = 'running';
        this._options.onUpdate();
      },
      onTestEnd: (test, testResult) => {
        if (test.outcome() === 'skipped') ++this.progress.skipped;else if (test.outcome() === 'unexpected') ++this.progress.failed;else ++this.progress.passed;
        testResult[_testTree.statusEx] = testResult.status;
        this._options.onUpdate();
      },
      onError: error => this._handleOnError(error),
      printsToStdio: () => false
    };
  }
  processGlobalReport(report) {
    const receiver = new _teleReceiver.TeleReporterReceiver({
      version: () => 'v2',
      onConfigure: c => {
        this.config = c;
      },
      onError: error => this._handleOnError(error)
    });
    for (const message of report) void receiver.dispatch(message);
  }
  processListReport(report) {
    var _this$rootSuite;
    // Save test results and reset all projects, the results will be restored after
    // new project structure is built.
    const tests = ((_this$rootSuite = this.rootSuite) === null || _this$rootSuite === void 0 ? void 0 : _this$rootSuite.allTests()) || [];
    this._testResultsSnapshot = new Map(tests.map(test => [test.id, test.results]));
    this._receiver.reset();
    for (const message of report) void this._receiver.dispatch(message);
  }
  processTestReportEvent(message) {
    var _this$_lastRunReceive, _this$_receiver$dispa;
    // The order of receiver dispatches matters here, we want to assign `lastRunTestCount`
    // before we use it.
    (_this$_lastRunReceive = this._lastRunReceiver) === null || _this$_lastRunReceive === void 0 || (_this$_lastRunReceive = _this$_lastRunReceive.dispatch(message)) === null || _this$_lastRunReceive === void 0 || _this$_lastRunReceive.catch(() => {});
    (_this$_receiver$dispa = this._receiver.dispatch(message)) === null || _this$_receiver$dispa === void 0 || _this$_receiver$dispa.catch(() => {});
  }
  _handleOnError(error) {
    var _this$_options$onErro, _this$_options;
    this.loadErrors.push(error);
    (_this$_options$onErro = (_this$_options = this._options).onError) === null || _this$_options$onErro === void 0 || _this$_options$onErro.call(_this$_options, error);
    this._options.onUpdate();
  }
  asModel() {
    return {
      rootSuite: this.rootSuite || new _teleReceiver.TeleSuite('', 'root'),
      config: this.config,
      loadErrors: this.loadErrors,
      progress: this.progress
    };
  }
}
exports.TeleSuiteUpdater = TeleSuiteUpdater;