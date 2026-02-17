"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.toHaveURLWithPredicate = toHaveURLWithPredicate;
var _utils = require("playwright-core/lib/utils");
var _expect = require("./expect");
var _matcherHint = require("./matcherHint");
var _expectBundle = require("../common/expectBundle");
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

async function toHaveURLWithPredicate(page, expected, options) {
  var _options$timeout;
  const matcherName = 'toHaveURL';
  const expression = 'page';
  const matcherOptions = {
    isNot: this.isNot,
    promise: this.promise
  };
  if (typeof expected !== 'function') {
    throw new Error([
    // Always display `expected` in expectation place
    (0, _matcherHint.matcherHint)(this, undefined, matcherName, expression, undefined, matcherOptions), `${_utils.colors.bold('Matcher error')}: ${(0, _expectBundle.EXPECTED_COLOR)('expected')} value must be a string, regular expression, or predicate`, this.utils.printWithType('Expected', expected, this.utils.printExpected)].join('\n\n'));
  }
  const timeout = (_options$timeout = options === null || options === void 0 ? void 0 : options.timeout) !== null && _options$timeout !== void 0 ? _options$timeout : this.timeout;
  const baseURL = page.context()._options.baseURL;
  let conditionSucceeded = false;
  let lastCheckedURLString = undefined;
  try {
    await page.mainFrame().waitForURL(url => {
      lastCheckedURLString = url.toString();
      if (options !== null && options !== void 0 && options.ignoreCase) {
        return !this.isNot === (0, _utils.urlMatches)(baseURL === null || baseURL === void 0 ? void 0 : baseURL.toLocaleLowerCase(), lastCheckedURLString.toLocaleLowerCase(), expected);
      }
      return !this.isNot === (0, _utils.urlMatches)(baseURL, lastCheckedURLString, expected);
    }, {
      timeout
    });
    conditionSucceeded = true;
  } catch (e) {
    conditionSucceeded = false;
  }
  if (conditionSucceeded) return {
    name: matcherName,
    pass: !this.isNot,
    message: () => ''
  };
  return {
    name: matcherName,
    pass: this.isNot,
    message: () => toHaveURLMessage(this, matcherName, expression, expected, lastCheckedURLString, this.isNot, true, timeout),
    actual: lastCheckedURLString,
    timeout
  };
}
function toHaveURLMessage(state, matcherName, expression, expected, received, pass, didTimeout, timeout) {
  const matcherOptions = {
    isNot: state.isNot,
    promise: state.promise
  };
  const receivedString = received || '';
  const messagePrefix = (0, _matcherHint.matcherHint)(state, undefined, matcherName, expression, undefined, matcherOptions, didTimeout ? timeout : undefined);
  let printedReceived;
  let printedExpected;
  let printedDiff;
  if (typeof expected === 'function') {
    printedExpected = `Expected predicate to ${!state.isNot ? 'succeed' : 'fail'}`;
    printedReceived = `Received string: ${(0, _expectBundle.printReceived)(receivedString)}`;
  } else {
    if (pass) {
      printedExpected = `Expected pattern: not ${state.utils.printExpected(expected)}`;
      const formattedReceived = (0, _expect.printReceivedStringContainExpectedResult)(receivedString, null);
      printedReceived = `Received string: ${formattedReceived}`;
    } else {
      const labelExpected = `Expected ${typeof expected === 'string' ? 'string' : 'pattern'}`;
      printedDiff = state.utils.printDiffOrStringify(expected, receivedString, labelExpected, 'Received string', false);
    }
  }
  const resultDetails = printedDiff ? printedDiff : printedExpected + '\n' + printedReceived;
  return messagePrefix + resultDetails;
}