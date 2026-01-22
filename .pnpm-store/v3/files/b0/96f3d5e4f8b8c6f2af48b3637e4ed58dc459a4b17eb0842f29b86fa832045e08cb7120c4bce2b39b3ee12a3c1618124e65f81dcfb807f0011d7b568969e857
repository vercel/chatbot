"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.expect = void 0;
exports.mergeExpects = mergeExpects;
exports.printReceivedStringContainExpectedSubstring = exports.printReceivedStringContainExpectedResult = void 0;
var _utils = require("playwright-core/lib/utils");
var _matcherHint = require("./matcherHint");
var _matchers = require("./matchers");
var _toMatchAriaSnapshot = require("./toMatchAriaSnapshot");
var _toMatchSnapshot = require("./toMatchSnapshot");
var _expectBundle = require("../common/expectBundle");
var _globals = require("../common/globals");
var _util = require("../util");
var _testInfo = require("../worker/testInfo");
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

// #region
// Mirrored from https://github.com/facebook/jest/blob/f13abff8df9a0e1148baf3584bcde6d1b479edc7/packages/expect/src/print.ts
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found here
 * https://github.com/facebook/jest/blob/1547740bbc26400d69f4576bf35645163e942829/LICENSE
 */

// Format substring but do not enclose in double quote marks.
// The replacement is compatible with pretty-format package.
const printSubstring = val => val.replace(/"|\\/g, '\\$&');
const printReceivedStringContainExpectedSubstring = (received, start, length // not end
) => (0, _expectBundle.RECEIVED_COLOR)('"' + printSubstring(received.slice(0, start)) + (0, _expectBundle.INVERTED_COLOR)(printSubstring(received.slice(start, start + length))) + printSubstring(received.slice(start + length)) + '"');
exports.printReceivedStringContainExpectedSubstring = printReceivedStringContainExpectedSubstring;
const printReceivedStringContainExpectedResult = (received, result) => result === null ? (0, _expectBundle.printReceived)(received) : printReceivedStringContainExpectedSubstring(received, result.index, result[0].length);

// #endregion
exports.printReceivedStringContainExpectedResult = printReceivedStringContainExpectedResult;
function createMatchers(actual, info, prefix) {
  return new Proxy((0, _expectBundle.expect)(actual), new ExpectMetaInfoProxyHandler(info, prefix));
}
const userMatchersSymbol = Symbol('userMatchers');
function qualifiedMatcherName(qualifier, matcherName) {
  return qualifier.join(':') + '$' + matcherName;
}
function createExpect(info, prefix, userMatchers) {
  const expectInstance = new Proxy(_expectBundle.expect, {
    apply: function (target, thisArg, argumentsList) {
      const [actual, messageOrOptions] = argumentsList;
      const message = (0, _utils.isString)(messageOrOptions) ? messageOrOptions : (messageOrOptions === null || messageOrOptions === void 0 ? void 0 : messageOrOptions.message) || info.message;
      const newInfo = {
        ...info,
        message
      };
      if (newInfo.poll) {
        if (typeof actual !== 'function') throw new Error('`expect.poll()` accepts only function as a first argument');
        newInfo.poll.generator = actual;
      }
      return createMatchers(actual, newInfo, prefix);
    },
    get: function (target, property) {
      if (property === 'configure') return configure;
      if (property === 'extend') {
        return matchers => {
          const qualifier = [...prefix, (0, _utils.createGuid)()];
          const wrappedMatchers = {};
          for (const [name, matcher] of Object.entries(matchers)) {
            wrappedMatchers[name] = wrapPlaywrightMatcherToPassNiceThis(matcher);
            const key = qualifiedMatcherName(qualifier, name);
            wrappedMatchers[key] = wrappedMatchers[name];
            Object.defineProperty(wrappedMatchers[key], 'name', {
              value: name
            });
          }
          _expectBundle.expect.extend(wrappedMatchers);
          return createExpect(info, qualifier, {
            ...userMatchers,
            ...matchers
          });
        };
      }
      if (property === 'soft') {
        return (actual, messageOrOptions) => {
          return configure({
            soft: true
          })(actual, messageOrOptions);
        };
      }
      if (property === userMatchersSymbol) return userMatchers;
      if (property === 'poll') {
        return (actual, messageOrOptions) => {
          const poll = (0, _utils.isString)(messageOrOptions) ? {} : messageOrOptions || {};
          return configure({
            _poll: poll
          })(actual, messageOrOptions);
        };
      }
      return _expectBundle.expect[property];
    }
  });
  const configure = configuration => {
    const newInfo = {
      ...info
    };
    if ('message' in configuration) newInfo.message = configuration.message;
    if ('timeout' in configuration) newInfo.timeout = configuration.timeout;
    if ('soft' in configuration) newInfo.isSoft = configuration.soft;
    if ('_poll' in configuration) {
      newInfo.poll = configuration._poll ? {
        ...info.poll,
        generator: () => {}
      } : undefined;
      if (typeof configuration._poll === 'object') {
        var _configuration$_poll$, _configuration$_poll$2;
        newInfo.poll.timeout = (_configuration$_poll$ = configuration._poll.timeout) !== null && _configuration$_poll$ !== void 0 ? _configuration$_poll$ : newInfo.poll.timeout;
        newInfo.poll.intervals = (_configuration$_poll$2 = configuration._poll.intervals) !== null && _configuration$_poll$2 !== void 0 ? _configuration$_poll$2 : newInfo.poll.intervals;
      }
    }
    return createExpect(newInfo, prefix, userMatchers);
  };
  return expectInstance;
}

// Expect wraps matchers, so there is no way to pass this information to the raw Playwright matcher.
// Rely on sync call sequence to seed each matcher call with the context.

let matcherCallContext;
function setMatcherCallContext(context) {
  matcherCallContext = context;
}
function takeMatcherCallContext() {
  try {
    return matcherCallContext;
  } finally {
    matcherCallContext = undefined;
  }
}
const defaultExpectTimeout = 5000;
function wrapPlaywrightMatcherToPassNiceThis(matcher) {
  return function (...args) {
    var _ref, _context$expectInfo$t, _context$testInfo;
    const {
      isNot,
      promise,
      utils
    } = this;
    const context = takeMatcherCallContext();
    const timeout = (_ref = (_context$expectInfo$t = context.expectInfo.timeout) !== null && _context$expectInfo$t !== void 0 ? _context$expectInfo$t : (_context$testInfo = context.testInfo) === null || _context$testInfo === void 0 || (_context$testInfo = _context$testInfo._projectInternal) === null || _context$testInfo === void 0 || (_context$testInfo = _context$testInfo.expect) === null || _context$testInfo === void 0 ? void 0 : _context$testInfo.timeout) !== null && _ref !== void 0 ? _ref : defaultExpectTimeout;
    const newThis = {
      isNot,
      promise,
      utils,
      timeout,
      _stepInfo: context.step
    };
    newThis.equals = throwUnsupportedExpectMatcherError;
    return matcher.call(newThis, ...args);
  };
}
function throwUnsupportedExpectMatcherError() {
  throw new Error('It looks like you are using custom expect matchers that are not compatible with Playwright. See https://aka.ms/playwright/expect-compatibility');
}
_expectBundle.expect.setState({
  expand: false
});
const customAsyncMatchers = {
  toBeAttached: _matchers.toBeAttached,
  toBeChecked: _matchers.toBeChecked,
  toBeDisabled: _matchers.toBeDisabled,
  toBeEditable: _matchers.toBeEditable,
  toBeEmpty: _matchers.toBeEmpty,
  toBeEnabled: _matchers.toBeEnabled,
  toBeFocused: _matchers.toBeFocused,
  toBeHidden: _matchers.toBeHidden,
  toBeInViewport: _matchers.toBeInViewport,
  toBeOK: _matchers.toBeOK,
  toBeVisible: _matchers.toBeVisible,
  toContainText: _matchers.toContainText,
  toHaveAccessibleDescription: _matchers.toHaveAccessibleDescription,
  toHaveAccessibleName: _matchers.toHaveAccessibleName,
  toHaveAccessibleErrorMessage: _matchers.toHaveAccessibleErrorMessage,
  toHaveAttribute: _matchers.toHaveAttribute,
  toHaveClass: _matchers.toHaveClass,
  toHaveCount: _matchers.toHaveCount,
  toHaveCSS: _matchers.toHaveCSS,
  toHaveId: _matchers.toHaveId,
  toHaveJSProperty: _matchers.toHaveJSProperty,
  toHaveRole: _matchers.toHaveRole,
  toHaveText: _matchers.toHaveText,
  toHaveTitle: _matchers.toHaveTitle,
  toHaveURL: _matchers.toHaveURL,
  toHaveValue: _matchers.toHaveValue,
  toHaveValues: _matchers.toHaveValues,
  toHaveScreenshot: _toMatchSnapshot.toHaveScreenshot,
  toMatchAriaSnapshot: _toMatchAriaSnapshot.toMatchAriaSnapshot,
  toPass: _matchers.toPass
};
const customMatchers = {
  ...customAsyncMatchers,
  toMatchSnapshot: _toMatchSnapshot.toMatchSnapshot
};
class ExpectMetaInfoProxyHandler {
  constructor(info, prefix) {
    this._info = void 0;
    this._prefix = void 0;
    this._info = {
      ...info
    };
    this._prefix = prefix;
  }
  get(target, matcherName, receiver) {
    let matcher = Reflect.get(target, matcherName, receiver);
    if (typeof matcherName !== 'string') return matcher;
    let resolvedMatcherName = matcherName;
    for (let i = this._prefix.length; i > 0; i--) {
      const qualifiedName = qualifiedMatcherName(this._prefix.slice(0, i), matcherName);
      if (Reflect.has(target, qualifiedName)) {
        matcher = Reflect.get(target, qualifiedName, receiver);
        resolvedMatcherName = qualifiedName;
        break;
      }
    }
    if (matcher === undefined) throw new Error(`expect: Property '${matcherName}' not found.`);
    if (typeof matcher !== 'function') {
      if (matcherName === 'not') this._info.isNot = !this._info.isNot;
      return new Proxy(matcher, this);
    }
    if (this._info.poll) {
      if (customAsyncMatchers[matcherName] || matcherName === 'resolves' || matcherName === 'rejects') throw new Error(`\`expect.poll()\` does not support "${matcherName}" matcher.`);
      matcher = (...args) => pollMatcher(resolvedMatcherName, this._info, this._prefix, ...args);
    }
    return (...args) => {
      const testInfo = (0, _globals.currentTestInfo)();
      setMatcherCallContext({
        expectInfo: this._info,
        testInfo
      });
      if (!testInfo) return matcher.call(target, ...args);
      const customMessage = this._info.message || '';
      const argsSuffix = computeArgsSuffix(matcherName, args);
      const defaultTitle = `expect${this._info.poll ? '.poll' : ''}${this._info.isSoft ? '.soft' : ''}${this._info.isNot ? '.not' : ''}.${matcherName}${argsSuffix}`;
      const title = customMessage || defaultTitle;

      // This looks like it is unnecessary, but it isn't - we need to filter
      // out all the frames that belong to the test runner from caught runtime errors.
      const stackFrames = (0, _util.filteredStackTrace)((0, _utils.captureRawStack)());

      // toPass and poll matchers can contain other steps, expects and API calls,
      // so they behave like a retriable step.
      const stepInfo = {
        category: matcherName === 'toPass' || this._info.poll ? 'step' : 'expect',
        title: (0, _util.trimLongString)(title, 1024),
        params: args[0] ? {
          expected: args[0]
        } : undefined,
        infectParentStepsWithError: this._info.isSoft
      };
      const step = testInfo._addStep(stepInfo);
      const reportStepError = e => {
        const jestError = (0, _matcherHint.isJestError)(e) ? e : null;
        const error = jestError ? new _matcherHint.ExpectError(jestError, customMessage, stackFrames) : e;
        if (jestError !== null && jestError !== void 0 && jestError.matcherResult.suggestedRebaseline) {
          // NOTE: this is a workaround for the fact that we can't pass the suggested rebaseline
          // for passing matchers. See toMatchAriaSnapshot for a counterpart.
          step.complete({
            suggestedRebaseline: jestError === null || jestError === void 0 ? void 0 : jestError.matcherResult.suggestedRebaseline
          });
          return;
        }
        step.complete({
          error
        });
        if (this._info.isSoft) testInfo._failWithError(error);else throw error;
      };
      const finalizer = () => {
        step.complete({});
      };
      try {
        setMatcherCallContext({
          expectInfo: this._info,
          testInfo,
          step: step.info
        });
        const callback = () => matcher.call(target, ...args);
        const result = (0, _utils.currentZone)().with('stepZone', step).run(callback);
        if (result instanceof Promise) {
          const promise = result.then(finalizer).catch(reportStepError);
          return testInfo._floatingPromiseScope.wrapPromiseAPIResult(promise);
        }
        finalizer();
        return result;
      } catch (e) {
        reportStepError(e);
      }
    };
  }
}
async function pollMatcher(qualifiedMatcherName, info, prefix, ...args) {
  var _ref2, _ref3, _poll$timeout, _testInfo$_projectInt, _poll$intervals;
  const testInfo = (0, _globals.currentTestInfo)();
  const poll = info.poll;
  const timeout = (_ref2 = (_ref3 = (_poll$timeout = poll.timeout) !== null && _poll$timeout !== void 0 ? _poll$timeout : info.timeout) !== null && _ref3 !== void 0 ? _ref3 : testInfo === null || testInfo === void 0 || (_testInfo$_projectInt = testInfo._projectInternal) === null || _testInfo$_projectInt === void 0 || (_testInfo$_projectInt = _testInfo$_projectInt.expect) === null || _testInfo$_projectInt === void 0 ? void 0 : _testInfo$_projectInt.timeout) !== null && _ref2 !== void 0 ? _ref2 : defaultExpectTimeout;
  const {
    deadline,
    timeoutMessage
  } = testInfo ? testInfo._deadlineForMatcher(timeout) : _testInfo.TestInfoImpl._defaultDeadlineForMatcher(timeout);
  const result = await (0, _utils.pollAgainstDeadline)(async () => {
    if (testInfo && (0, _globals.currentTestInfo)() !== testInfo) return {
      continuePolling: false,
      result: undefined
    };
    const innerInfo = {
      ...info,
      isSoft: false,
      // soft is outside of poll, not inside
      poll: undefined
    };
    const value = await poll.generator();
    try {
      let matchers = createMatchers(value, innerInfo, prefix);
      if (info.isNot) matchers = matchers.not;
      matchers[qualifiedMatcherName](...args);
      return {
        continuePolling: false,
        result: undefined
      };
    } catch (error) {
      return {
        continuePolling: true,
        result: error
      };
    }
  }, deadline, (_poll$intervals = poll.intervals) !== null && _poll$intervals !== void 0 ? _poll$intervals : [100, 250, 500, 1000]);
  if (result.timedOut) {
    const message = result.result ? [result.result.message, '', `Call Log:`, `- ${timeoutMessage}`].join('\n') : timeoutMessage;
    throw new Error(message);
  }
}
function computeArgsSuffix(matcherName, args) {
  let value = '';
  if (matcherName === 'toHaveScreenshot') value = (0, _toMatchSnapshot.toHaveScreenshotStepTitle)(...args);
  return value ? `(${value})` : '';
}
const expect = exports.expect = createExpect({}, [], {}).extend(customMatchers);
function mergeExpects(...expects) {
  let merged = expect;
  for (const e of expects) {
    const internals = e[userMatchersSymbol];
    if (!internals)
      // non-playwright expects mutate the global expect, so we don't need to do anything special
      continue;
    merged = merged.extend(internals);
  }
  return merged;
}