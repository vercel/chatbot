"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.toMatchText = toMatchText;
var _utils = require("playwright-core/lib/utils");
var _util = require("../util");
var _expect = require("./expect");
var _matcherHint = require("./matcherHint");
var _expectBundle = require("../common/expectBundle");
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

async function toMatchText(matcherName, receiver, receiverType, query, expected, options = {}) {
  var _options$timeout;
  (0, _util.expectTypes)(receiver, [receiverType], matcherName);
  const matcherOptions = {
    isNot: this.isNot,
    promise: this.promise
  };
  if (!(typeof expected === 'string') && !(expected && typeof expected.test === 'function')) {
    // Same format as jest's matcherErrorMessage
    throw new Error([(0, _matcherHint.matcherHint)(this, receiver, matcherName, receiver, expected, matcherOptions), `${_utils.colors.bold('Matcher error')}: ${(0, _expectBundle.EXPECTED_COLOR)('expected')} value must be a string or regular expression`, this.utils.printWithType('Expected', expected, this.utils.printExpected)].join('\n\n'));
  }
  const timeout = (_options$timeout = options.timeout) !== null && _options$timeout !== void 0 ? _options$timeout : this.timeout;
  const {
    matches: pass,
    received,
    log,
    timedOut
  } = await query(!!this.isNot, timeout);
  if (pass === !this.isNot) {
    return {
      name: matcherName,
      message: () => '',
      pass,
      expected
    };
  }
  const stringSubstring = options.matchSubstring ? 'substring' : 'string';
  const receivedString = received || '';
  const messagePrefix = (0, _matcherHint.matcherHint)(this, receiver, matcherName, 'locator', undefined, matcherOptions, timedOut ? timeout : undefined);
  const notFound = received === _matcherHint.kNoElementsFoundError;
  let printedReceived;
  let printedExpected;
  let printedDiff;
  if (pass) {
    if (typeof expected === 'string') {
      if (notFound) {
        printedExpected = `Expected ${stringSubstring}: not ${this.utils.printExpected(expected)}`;
        printedReceived = `Received: ${received}`;
      } else {
        printedExpected = `Expected ${stringSubstring}: not ${this.utils.printExpected(expected)}`;
        const formattedReceived = (0, _expect.printReceivedStringContainExpectedSubstring)(receivedString, receivedString.indexOf(expected), expected.length);
        printedReceived = `Received string: ${formattedReceived}`;
      }
    } else {
      if (notFound) {
        printedExpected = `Expected pattern: not ${this.utils.printExpected(expected)}`;
        printedReceived = `Received: ${received}`;
      } else {
        printedExpected = `Expected pattern: not ${this.utils.printExpected(expected)}`;
        const formattedReceived = (0, _expect.printReceivedStringContainExpectedResult)(receivedString, typeof expected.exec === 'function' ? expected.exec(receivedString) : null);
        printedReceived = `Received string: ${formattedReceived}`;
      }
    }
  } else {
    const labelExpected = `Expected ${typeof expected === 'string' ? stringSubstring : 'pattern'}`;
    if (notFound) {
      printedExpected = `${labelExpected}: ${this.utils.printExpected(expected)}`;
      printedReceived = `Received: ${received}`;
    } else {
      printedDiff = this.utils.printDiffOrStringify(expected, receivedString, labelExpected, 'Received string', false);
    }
  }
  const message = () => {
    const resultDetails = printedDiff ? printedDiff : printedExpected + '\n' + printedReceived;
    return messagePrefix + resultDetails + (0, _util.callLogText)(log);
  };
  return {
    name: matcherName,
    expected,
    message,
    pass,
    actual: received,
    log,
    timeout: timedOut ? timeout : undefined
  };
}