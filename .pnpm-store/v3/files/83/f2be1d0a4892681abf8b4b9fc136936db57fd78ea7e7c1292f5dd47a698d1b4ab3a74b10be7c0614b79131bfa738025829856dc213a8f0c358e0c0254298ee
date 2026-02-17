"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Multiplexer = void 0;
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

class Multiplexer {
  constructor(reporters) {
    this._reporters = void 0;
    this._reporters = reporters;
  }
  version() {
    return 'v2';
  }
  onConfigure(config) {
    for (const reporter of this._reporters) wrap(() => {
      var _reporter$onConfigure;
      return (_reporter$onConfigure = reporter.onConfigure) === null || _reporter$onConfigure === void 0 ? void 0 : _reporter$onConfigure.call(reporter, config);
    });
  }
  onBegin(suite) {
    for (const reporter of this._reporters) wrap(() => {
      var _reporter$onBegin;
      return (_reporter$onBegin = reporter.onBegin) === null || _reporter$onBegin === void 0 ? void 0 : _reporter$onBegin.call(reporter, suite);
    });
  }
  onTestBegin(test, result) {
    for (const reporter of this._reporters) wrap(() => {
      var _reporter$onTestBegin;
      return (_reporter$onTestBegin = reporter.onTestBegin) === null || _reporter$onTestBegin === void 0 ? void 0 : _reporter$onTestBegin.call(reporter, test, result);
    });
  }
  onStdOut(chunk, test, result) {
    for (const reporter of this._reporters) wrap(() => {
      var _reporter$onStdOut;
      return (_reporter$onStdOut = reporter.onStdOut) === null || _reporter$onStdOut === void 0 ? void 0 : _reporter$onStdOut.call(reporter, chunk, test, result);
    });
  }
  onStdErr(chunk, test, result) {
    for (const reporter of this._reporters) wrap(() => {
      var _reporter$onStdErr;
      return (_reporter$onStdErr = reporter.onStdErr) === null || _reporter$onStdErr === void 0 ? void 0 : _reporter$onStdErr.call(reporter, chunk, test, result);
    });
  }
  onTestEnd(test, result) {
    for (const reporter of this._reporters) wrap(() => {
      var _reporter$onTestEnd;
      return (_reporter$onTestEnd = reporter.onTestEnd) === null || _reporter$onTestEnd === void 0 ? void 0 : _reporter$onTestEnd.call(reporter, test, result);
    });
  }
  async onEnd(result) {
    for (const reporter of this._reporters) {
      const outResult = await wrapAsync(() => {
        var _reporter$onEnd;
        return (_reporter$onEnd = reporter.onEnd) === null || _reporter$onEnd === void 0 ? void 0 : _reporter$onEnd.call(reporter, result);
      });
      if (outResult !== null && outResult !== void 0 && outResult.status) result.status = outResult.status;
    }
    return result;
  }
  async onExit() {
    for (const reporter of this._reporters) await wrapAsync(() => {
      var _reporter$onExit;
      return (_reporter$onExit = reporter.onExit) === null || _reporter$onExit === void 0 ? void 0 : _reporter$onExit.call(reporter);
    });
  }
  onError(error) {
    for (const reporter of this._reporters) wrap(() => {
      var _reporter$onError;
      return (_reporter$onError = reporter.onError) === null || _reporter$onError === void 0 ? void 0 : _reporter$onError.call(reporter, error);
    });
  }
  onStepBegin(test, result, step) {
    for (const reporter of this._reporters) wrap(() => {
      var _reporter$onStepBegin;
      return (_reporter$onStepBegin = reporter.onStepBegin) === null || _reporter$onStepBegin === void 0 ? void 0 : _reporter$onStepBegin.call(reporter, test, result, step);
    });
  }
  onStepEnd(test, result, step) {
    for (const reporter of this._reporters) wrap(() => {
      var _reporter$onStepEnd;
      return (_reporter$onStepEnd = reporter.onStepEnd) === null || _reporter$onStepEnd === void 0 ? void 0 : _reporter$onStepEnd.call(reporter, test, result, step);
    });
  }
  printsToStdio() {
    return this._reporters.some(r => {
      let prints = false;
      wrap(() => prints = r.printsToStdio ? r.printsToStdio() : true);
      return prints;
    });
  }
}
exports.Multiplexer = Multiplexer;
async function wrapAsync(callback) {
  try {
    return await callback();
  } catch (e) {
    console.error('Error in reporter', e);
  }
}
function wrap(callback) {
  try {
    callback();
  } catch (e) {
    console.error('Error in reporter', e);
  }
}