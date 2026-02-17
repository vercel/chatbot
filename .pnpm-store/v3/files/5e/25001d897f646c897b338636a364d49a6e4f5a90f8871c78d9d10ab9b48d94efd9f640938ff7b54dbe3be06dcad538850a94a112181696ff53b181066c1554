"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.InternalReporter = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _utils = require("playwright-core/lib/utils");
var _base = require("./base");
var _multiplexer = require("./multiplexer");
var _test = require("../common/test");
var _babelBundle = require("../transform/babelBundle");
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

class InternalReporter {
  constructor(reporters) {
    this._reporter = void 0;
    this._didBegin = false;
    this._config = void 0;
    this._startTime = void 0;
    this._monotonicStartTime = void 0;
    this._reporter = new _multiplexer.Multiplexer(reporters);
  }
  version() {
    return 'v2';
  }
  onConfigure(config) {
    var _this$_reporter$onCon, _this$_reporter;
    this._config = config;
    this._startTime = new Date();
    this._monotonicStartTime = (0, _utils.monotonicTime)();
    (_this$_reporter$onCon = (_this$_reporter = this._reporter).onConfigure) === null || _this$_reporter$onCon === void 0 || _this$_reporter$onCon.call(_this$_reporter, config);
  }
  onBegin(suite) {
    var _this$_reporter$onBeg, _this$_reporter2;
    this._didBegin = true;
    (_this$_reporter$onBeg = (_this$_reporter2 = this._reporter).onBegin) === null || _this$_reporter$onBeg === void 0 || _this$_reporter$onBeg.call(_this$_reporter2, suite);
  }
  onTestBegin(test, result) {
    var _this$_reporter$onTes, _this$_reporter3;
    (_this$_reporter$onTes = (_this$_reporter3 = this._reporter).onTestBegin) === null || _this$_reporter$onTes === void 0 || _this$_reporter$onTes.call(_this$_reporter3, test, result);
  }
  onStdOut(chunk, test, result) {
    var _this$_reporter$onStd, _this$_reporter4;
    (_this$_reporter$onStd = (_this$_reporter4 = this._reporter).onStdOut) === null || _this$_reporter$onStd === void 0 || _this$_reporter$onStd.call(_this$_reporter4, chunk, test, result);
  }
  onStdErr(chunk, test, result) {
    var _this$_reporter$onStd2, _this$_reporter5;
    (_this$_reporter$onStd2 = (_this$_reporter5 = this._reporter).onStdErr) === null || _this$_reporter$onStd2 === void 0 || _this$_reporter$onStd2.call(_this$_reporter5, chunk, test, result);
  }
  onTestEnd(test, result) {
    var _this$_reporter$onTes2, _this$_reporter6;
    this._addSnippetToTestErrors(test, result);
    (_this$_reporter$onTes2 = (_this$_reporter6 = this._reporter).onTestEnd) === null || _this$_reporter$onTes2 === void 0 || _this$_reporter$onTes2.call(_this$_reporter6, test, result);
  }
  async onEnd(result) {
    var _this$_reporter$onEnd, _this$_reporter7;
    if (!this._didBegin) {
      // onBegin was not reported, emit it.
      this.onBegin(new _test.Suite('', 'root'));
    }
    return await ((_this$_reporter$onEnd = (_this$_reporter7 = this._reporter).onEnd) === null || _this$_reporter$onEnd === void 0 ? void 0 : _this$_reporter$onEnd.call(_this$_reporter7, {
      ...result,
      startTime: this._startTime,
      duration: (0, _utils.monotonicTime)() - this._monotonicStartTime
    }));
  }
  async onExit() {
    var _this$_reporter$onExi, _this$_reporter8;
    await ((_this$_reporter$onExi = (_this$_reporter8 = this._reporter).onExit) === null || _this$_reporter$onExi === void 0 ? void 0 : _this$_reporter$onExi.call(_this$_reporter8));
  }
  onError(error) {
    var _this$_reporter$onErr, _this$_reporter9;
    addLocationAndSnippetToError(this._config, error);
    (_this$_reporter$onErr = (_this$_reporter9 = this._reporter).onError) === null || _this$_reporter$onErr === void 0 || _this$_reporter$onErr.call(_this$_reporter9, error);
  }
  onStepBegin(test, result, step) {
    var _this$_reporter$onSte, _this$_reporter10;
    (_this$_reporter$onSte = (_this$_reporter10 = this._reporter).onStepBegin) === null || _this$_reporter$onSte === void 0 || _this$_reporter$onSte.call(_this$_reporter10, test, result, step);
  }
  onStepEnd(test, result, step) {
    var _this$_reporter$onSte2, _this$_reporter11;
    this._addSnippetToStepError(test, step);
    (_this$_reporter$onSte2 = (_this$_reporter11 = this._reporter).onStepEnd) === null || _this$_reporter$onSte2 === void 0 || _this$_reporter$onSte2.call(_this$_reporter11, test, result, step);
  }
  printsToStdio() {
    return this._reporter.printsToStdio ? this._reporter.printsToStdio() : true;
  }
  _addSnippetToTestErrors(test, result) {
    for (const error of result.errors) addLocationAndSnippetToError(this._config, error, test.location.file);
  }
  _addSnippetToStepError(test, step) {
    if (step.error) addLocationAndSnippetToError(this._config, step.error, test.location.file);
  }
}
exports.InternalReporter = InternalReporter;
function addLocationAndSnippetToError(config, error, file) {
  if (error.stack && !error.location) error.location = (0, _base.prepareErrorStack)(error.stack).location;
  const location = error.location;
  if (!location) return;
  try {
    const tokens = [];
    const source = _fs.default.readFileSync(location.file, 'utf8');
    const codeFrame = (0, _babelBundle.codeFrameColumns)(source, {
      start: location
    }, {
      highlightCode: true
    });
    // Convert /var/folders to /private/var/folders on Mac.
    if (!file || _fs.default.realpathSync(file) !== location.file) {
      tokens.push(_base.internalScreen.colors.gray(`   at `) + `${(0, _base.relativeFilePath)(_base.internalScreen, config, location.file)}:${location.line}`);
      tokens.push('');
    }
    tokens.push(codeFrame);
    error.snippet = tokens.join('\n');
  } catch (e) {
    // Failed to read the source file - that's ok.
  }
}