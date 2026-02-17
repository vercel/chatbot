"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.toMatchAriaSnapshot = toMatchAriaSnapshot;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _utils = require("playwright-core/lib/utils");
var _matcherHint = require("./matcherHint");
var _expectBundle = require("../common/expectBundle");
var _util = require("../util");
var _expect = require("./expect");
var _globals = require("../common/globals");
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

async function toMatchAriaSnapshot(receiver, expectedParam, options = {}) {
  var _testInfo$_projectInt;
  const matcherName = 'toMatchAriaSnapshot';
  const testInfo = (0, _globals.currentTestInfo)();
  if (!testInfo) throw new Error(`toMatchAriaSnapshot() must be called during the test`);
  if (testInfo._projectInternal.ignoreSnapshots) return {
    pass: !this.isNot,
    message: () => '',
    name: 'toMatchAriaSnapshot',
    expected: ''
  };
  const updateSnapshots = testInfo.config.updateSnapshots;
  const pathTemplate = (_testInfo$_projectInt = testInfo._projectInternal.expect) === null || _testInfo$_projectInt === void 0 || (_testInfo$_projectInt = _testInfo$_projectInt.toMatchAriaSnapshot) === null || _testInfo$_projectInt === void 0 ? void 0 : _testInfo$_projectInt.pathTemplate;
  const defaultTemplate = '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}';
  const matcherOptions = {
    isNot: this.isNot,
    promise: this.promise
  };
  let expected;
  let timeout;
  let expectedPath;
  if ((0, _utils.isString)(expectedParam)) {
    var _options$timeout;
    expected = expectedParam;
    timeout = (_options$timeout = options.timeout) !== null && _options$timeout !== void 0 ? _options$timeout : this.timeout;
  } else {
    var _expectedParam$timeou;
    if (expectedParam !== null && expectedParam !== void 0 && expectedParam.name) {
      const ext = expectedParam.name.endsWith('.aria.yml') ? '.aria.yml' : undefined;
      expectedPath = testInfo._resolveSnapshotPath(pathTemplate, defaultTemplate, [(0, _util.sanitizeFilePathBeforeExtension)(expectedParam.name, ext)]);
    } else {
      let snapshotNames = testInfo[snapshotNamesSymbol];
      if (!snapshotNames) {
        snapshotNames = {
          anonymousSnapshotIndex: 0
        };
        testInfo[snapshotNamesSymbol] = snapshotNames;
      }
      const fullTitleWithoutSpec = [...testInfo.titlePath.slice(1), ++snapshotNames.anonymousSnapshotIndex].join(' ');
      expectedPath = testInfo._resolveSnapshotPath(pathTemplate, defaultTemplate, [(0, _utils.sanitizeForFilePath)((0, _util.trimLongString)(fullTitleWithoutSpec))], '.aria.yml');
      // in 1.51, we changed the default template to use .aria.yml extension
      // for backwards compatibility, we check for the legacy .yml extension
      if (!(await (0, _util.fileExistsAsync)(expectedPath))) {
        const legacyPath = testInfo._resolveSnapshotPath(pathTemplate, defaultTemplate, [(0, _utils.sanitizeForFilePath)((0, _util.trimLongString)(fullTitleWithoutSpec))], '.yml');
        if (await (0, _util.fileExistsAsync)(legacyPath)) expectedPath = legacyPath;
      }
    }
    expected = await _fs.default.promises.readFile(expectedPath, 'utf8').catch(() => '');
    timeout = (_expectedParam$timeou = expectedParam === null || expectedParam === void 0 ? void 0 : expectedParam.timeout) !== null && _expectedParam$timeou !== void 0 ? _expectedParam$timeou : this.timeout;
  }
  const generateMissingBaseline = updateSnapshots === 'missing' && !expected;
  if (generateMissingBaseline) {
    if (this.isNot) {
      const message = `Matchers using ".not" can't generate new baselines`;
      return {
        pass: this.isNot,
        message: () => message,
        name: 'toMatchAriaSnapshot'
      };
    } else {
      // When generating new baseline, run entire pipeline against impossible match.
      expected = `- none "Generating new baseline"`;
    }
  }
  expected = unshift(expected);
  const {
    matches: pass,
    received,
    log,
    timedOut
  } = await receiver._expect('to.match.aria', {
    expectedValue: expected,
    isNot: this.isNot,
    timeout
  });
  const typedReceived = received;
  const messagePrefix = (0, _matcherHint.matcherHint)(this, receiver, matcherName, 'locator', undefined, matcherOptions, timedOut ? timeout : undefined);
  const notFound = typedReceived === _matcherHint.kNoElementsFoundError;
  if (notFound) {
    return {
      pass: this.isNot,
      message: () => messagePrefix + `Expected: ${this.utils.printExpected(expected)}\nReceived: ${(0, _expectBundle.EXPECTED_COLOR)('<element not found>')}` + (0, _util.callLogText)(log),
      name: 'toMatchAriaSnapshot',
      expected
    };
  }
  const receivedText = typedReceived.raw;
  const message = () => {
    if (pass) {
      if (notFound) return messagePrefix + `Expected: not ${this.utils.printExpected(expected)}\nReceived: ${receivedText}` + (0, _util.callLogText)(log);
      const printedReceived = (0, _expect.printReceivedStringContainExpectedSubstring)(receivedText, receivedText.indexOf(expected), expected.length);
      return messagePrefix + `Expected: not ${this.utils.printExpected(expected)}\nReceived: ${printedReceived}` + (0, _util.callLogText)(log);
    } else {
      const labelExpected = `Expected`;
      if (notFound) return messagePrefix + `${labelExpected}: ${this.utils.printExpected(expected)}\nReceived: ${receivedText}` + (0, _util.callLogText)(log);
      return messagePrefix + this.utils.printDiffOrStringify(expected, receivedText, labelExpected, 'Received', false) + (0, _util.callLogText)(log);
    }
  };
  if (!this.isNot) {
    if (updateSnapshots === 'all' || updateSnapshots === 'changed' && pass === this.isNot || generateMissingBaseline) {
      if (expectedPath) {
        await _fs.default.promises.mkdir(_path.default.dirname(expectedPath), {
          recursive: true
        });
        await _fs.default.promises.writeFile(expectedPath, typedReceived.regex, 'utf8');
        const relativePath = _path.default.relative(process.cwd(), expectedPath);
        if (updateSnapshots === 'missing') {
          const message = `A snapshot doesn't exist at ${relativePath}, writing actual.`;
          testInfo._hasNonRetriableError = true;
          testInfo._failWithError(new Error(message));
        } else {
          const message = `A snapshot is generated at ${relativePath}.`;
          /* eslint-disable no-console */
          console.log(message);
        }
        return {
          pass: true,
          message: () => '',
          name: 'toMatchAriaSnapshot'
        };
      } else {
        const suggestedRebaseline = `\`\n${(0, _utils.escapeTemplateString)(indent(typedReceived.regex, '{indent}  '))}\n{indent}\``;
        if (updateSnapshots === 'missing') {
          const message = 'A snapshot is not provided, generating new baseline.';
          testInfo._hasNonRetriableError = true;
          testInfo._failWithError(new Error(message));
        }
        // TODO: ideally, we should return "pass: true" here because this matcher passes
        // when regenerating baselines. However, we can only access suggestedRebaseline in case
        // of an error, so we fail here and workaround it in the expect implementation.
        return {
          pass: false,
          message: () => '',
          name: 'toMatchAriaSnapshot',
          suggestedRebaseline
        };
      }
    }
  }
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
function unshift(snapshot) {
  const lines = snapshot.split('\n');
  let whitespacePrefixLength = 100;
  for (const line of lines) {
    if (!line.trim()) continue;
    const match = line.match(/^(\s*)/);
    if (match && match[1].length < whitespacePrefixLength) whitespacePrefixLength = match[1].length;
  }
  return lines.filter(t => t.trim()).map(line => line.substring(whitespacePrefixLength)).join('\n');
}
function indent(snapshot, indent) {
  return snapshot.split('\n').map(line => indent + line).join('\n');
}
const snapshotNamesSymbol = Symbol('snapshotNames');