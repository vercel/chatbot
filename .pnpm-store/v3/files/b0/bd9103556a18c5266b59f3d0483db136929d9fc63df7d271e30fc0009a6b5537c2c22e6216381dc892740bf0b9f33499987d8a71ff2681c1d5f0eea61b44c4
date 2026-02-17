"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.attachErrorPrompts = attachErrorPrompts;
var fs = _interopRequireWildcard(require("fs"));
var path = _interopRequireWildcard(require("path"));
var _utils = require("playwright-core/lib/utils");
var _util = require("./util");
var _babelBundle = require("./transform/babelBundle");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

async function attachErrorPrompts(testInfo, sourceCache, ariaSnapshot) {
  if (process.env.PLAYWRIGHT_NO_COPY_PROMPT) return;
  const meaningfulSingleLineErrors = new Set(testInfo.errors.filter(e => e.message && !e.message.includes('\n')).map(e => e.message));
  for (const error of testInfo.errors) {
    for (const singleLineError of meaningfulSingleLineErrors.keys()) {
      var _error$message;
      if ((_error$message = error.message) !== null && _error$message !== void 0 && _error$message.includes(singleLineError)) meaningfulSingleLineErrors.delete(singleLineError);
    }
  }
  for (const [index, error] of testInfo.errors.entries()) {
    if (!error.message) return;
    if (testInfo.attachments.find(a => a.name === `_prompt-${index}`)) continue;

    // Skip errors that are just a single line - they are likely to already be the error message.
    if (!error.message.includes('\n') && !meaningfulSingleLineErrors.has(error.message)) continue;
    const metadata = testInfo.config.metadata;
    const promptParts = [`# Instructions`, '', `- Following Playwright test failed.`, `- Explain why, be concise, respect Playwright best practices.`, `- Provide a snippet of code with the fix, if possible.`, '', `# Test info`, '', `- Name: ${testInfo.titlePath.slice(1).join(' >> ')}`, `- Location: ${testInfo.file}:${testInfo.line}:${testInfo.column}`, '', '# Error details', '', '```', (0, _util.stripAnsiEscapes)(error.stack || error.message || ''), '```'];
    if (ariaSnapshot) {
      promptParts.push('', '# Page snapshot', '', '```yaml', ariaSnapshot, '```');
    }
    const parsedError = error.stack ? (0, _utils.parseErrorStack)(error.stack, path.sep) : undefined;
    const inlineMessage = (0, _util.stripAnsiEscapes)((parsedError === null || parsedError === void 0 ? void 0 : parsedError.message) || error.message || '').split('\n')[0];
    const location = (parsedError === null || parsedError === void 0 ? void 0 : parsedError.location) || {
      file: testInfo.file,
      line: testInfo.line,
      column: testInfo.column
    };
    const source = await loadSource(location.file, sourceCache);
    const codeFrame = (0, _babelBundle.codeFrameColumns)(source, {
      start: {
        line: location.line,
        column: location.column
      }
    }, {
      highlightCode: false,
      linesAbove: 100,
      linesBelow: 100,
      message: inlineMessage || undefined
    });
    promptParts.push('', '# Test source', '', '```ts', codeFrame, '```');
    if (metadata.gitDiff) {
      promptParts.push('', '# Local changes', '', '```diff', metadata.gitDiff, '```');
    }
    testInfo._attach({
      name: `_prompt-${index}`,
      contentType: 'text/markdown',
      body: Buffer.from(promptParts.join('\n'))
    }, undefined);
  }
}
async function loadSource(file, sourceCache) {
  let source = sourceCache.get(file);
  if (!source) {
    // A mild race is Ok here.
    source = await fs.promises.readFile(file, 'utf8');
    sourceCache.set(file, source);
  }
  return source;
}