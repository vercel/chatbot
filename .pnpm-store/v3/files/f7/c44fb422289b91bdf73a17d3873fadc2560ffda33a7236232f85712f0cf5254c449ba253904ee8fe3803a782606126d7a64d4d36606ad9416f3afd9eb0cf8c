"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.kMaxDeadline = exports.TimeoutManagerError = exports.TimeoutManager = void 0;
var _utils = require("playwright-core/lib/utils");
var _util = require("../util");
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

const kMaxDeadline = exports.kMaxDeadline = 2147483647; // 2^31-1

class TimeoutManager {
  constructor(timeout) {
    this._defaultSlot = void 0;
    this._running = void 0;
    this._ignoreTimeouts = false;
    this._defaultSlot = {
      timeout,
      elapsed: 0
    };
  }
  setIgnoreTimeouts() {
    this._ignoreTimeouts = true;
    if (this._running) this._updateTimeout(this._running);
  }
  interrupt() {
    if (this._running) this._running.timeoutPromise.reject(this._createTimeoutError(this._running));
  }
  isTimeExhaustedFor(runnable) {
    var _runnable$fixture;
    const slot = ((_runnable$fixture = runnable.fixture) === null || _runnable$fixture === void 0 ? void 0 : _runnable$fixture.slot) || runnable.slot || this._defaultSlot;
    // Note: the "-1" here matches the +1 in _updateTimeout.
    return slot.timeout > 0 && slot.elapsed >= slot.timeout - 1;
  }
  async withRunnable(runnable, cb) {
    var _runnable$fixture2;
    if (this._running) throw new Error(`Internal error: duplicate runnable`);
    const running = this._running = {
      runnable,
      slot: ((_runnable$fixture2 = runnable.fixture) === null || _runnable$fixture2 === void 0 ? void 0 : _runnable$fixture2.slot) || runnable.slot || this._defaultSlot,
      start: (0, _utils.monotonicTime)(),
      deadline: kMaxDeadline,
      timer: undefined,
      timeoutPromise: new _utils.ManualPromise()
    };
    let debugTitle = '';
    try {
      if (_util.debugTest.enabled) {
        debugTitle = runnable.fixture ? `${runnable.fixture.phase} "${runnable.fixture.title}"` : runnable.type;
        const location = runnable.location ? ` at "${(0, _util.formatLocation)(runnable.location)}"` : ``;
        (0, _util.debugTest)(`started ${debugTitle}${location}`);
      }
      this._updateTimeout(running);
      return await Promise.race([cb(), running.timeoutPromise]);
    } finally {
      if (running.timer) clearTimeout(running.timer);
      running.timer = undefined;
      running.slot.elapsed += (0, _utils.monotonicTime)() - running.start;
      this._running = undefined;
      if (_util.debugTest.enabled) (0, _util.debugTest)(`finished ${debugTitle}`);
    }
  }
  _updateTimeout(running) {
    if (running.timer) clearTimeout(running.timer);
    running.timer = undefined;
    if (this._ignoreTimeouts || !running.slot.timeout) {
      running.deadline = kMaxDeadline;
      return;
    }
    running.deadline = running.start + (running.slot.timeout - running.slot.elapsed);
    // Compensate for Node.js troubles with timeouts that can fire too early.
    // We add an extra millisecond which seems to be enough.
    // See https://github.com/nodejs/node/issues/26578.
    const timeout = running.deadline - (0, _utils.monotonicTime)() + 1;
    if (timeout <= 0) running.timeoutPromise.reject(this._createTimeoutError(running));else running.timer = setTimeout(() => running.timeoutPromise.reject(this._createTimeoutError(running)), timeout);
  }
  defaultSlot() {
    return this._defaultSlot;
  }
  slow() {
    const slot = this._running ? this._running.slot : this._defaultSlot;
    slot.timeout = slot.timeout * 3;
    if (this._running) this._updateTimeout(this._running);
  }
  setTimeout(timeout) {
    const slot = this._running ? this._running.slot : this._defaultSlot;
    slot.timeout = timeout;
    if (this._running) this._updateTimeout(this._running);
  }
  currentSlotDeadline() {
    return this._running ? this._running.deadline : kMaxDeadline;
  }
  currentSlotType() {
    return this._running ? this._running.runnable.type : 'test';
  }
  _createTimeoutError(running) {
    var _runnable$fixture3;
    let message = '';
    const timeout = running.slot.timeout;
    const runnable = running.runnable;
    switch (runnable.type) {
      case 'test':
        {
          if (runnable.fixture) {
            if (runnable.fixture.phase === 'setup') message = `Test timeout of ${timeout}ms exceeded while setting up "${runnable.fixture.title}".`;else message = `Tearing down "${runnable.fixture.title}" exceeded the test timeout of ${timeout}ms.`;
          } else {
            message = `Test timeout of ${timeout}ms exceeded.`;
          }
          break;
        }
      case 'afterEach':
      case 'beforeEach':
        message = `Test timeout of ${timeout}ms exceeded while running "${runnable.type}" hook.`;
        break;
      case 'beforeAll':
      case 'afterAll':
        message = `"${runnable.type}" hook timeout of ${timeout}ms exceeded.`;
        break;
      case 'teardown':
        {
          if (runnable.fixture) message = `Worker teardown timeout of ${timeout}ms exceeded while ${runnable.fixture.phase === 'setup' ? 'setting up' : 'tearing down'} "${runnable.fixture.title}".`;else message = `Worker teardown timeout of ${timeout}ms exceeded.`;
          break;
        }
      case 'skip':
      case 'slow':
      case 'fixme':
      case 'fail':
        message = `"${runnable.type}" modifier timeout of ${timeout}ms exceeded.`;
        break;
    }
    const fixtureWithSlot = (_runnable$fixture3 = runnable.fixture) !== null && _runnable$fixture3 !== void 0 && _runnable$fixture3.slot ? runnable.fixture : undefined;
    if (fixtureWithSlot) message = `Fixture "${fixtureWithSlot.title}" timeout of ${timeout}ms exceeded during ${fixtureWithSlot.phase}.`;
    message = _utils.colors.red(message);
    const location = (fixtureWithSlot || runnable).location;
    const error = new TimeoutManagerError(message);
    error.name = '';
    // Include location for hooks, modifiers and fixtures to distinguish between them.
    error.stack = message + (location ? `\n    at ${location.file}:${location.line}:${location.column}` : '');
    return error;
  }
}
exports.TimeoutManager = TimeoutManager;
class TimeoutManagerError extends Error {}
exports.TimeoutManagerError = TimeoutManagerError;