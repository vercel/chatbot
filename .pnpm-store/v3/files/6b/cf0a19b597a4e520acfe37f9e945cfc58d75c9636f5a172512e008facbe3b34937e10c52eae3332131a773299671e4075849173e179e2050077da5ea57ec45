"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TerminalReporter = void 0;
exports.fitToWidth = fitToWidth;
exports.formatError = formatError;
exports.formatFailure = formatFailure;
exports.formatResultFailure = formatResultFailure;
exports.formatRetry = formatRetry;
exports.nonTerminalScreen = exports.kOutputSymbol = exports.internalScreen = void 0;
exports.prepareErrorStack = prepareErrorStack;
exports.relativeFilePath = relativeFilePath;
exports.resolveOutputFile = resolveOutputFile;
exports.separator = separator;
exports.stepSuffix = stepSuffix;
exports.terminalScreen = void 0;
var _path = _interopRequireDefault(require("path"));
var _utils = require("playwright-core/lib/utils");
var _utilsBundle = require("playwright-core/lib/utilsBundle");
var _util = require("../util");
var _utilsBundle2 = require("../utilsBundle");
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

const kOutputSymbol = exports.kOutputSymbol = Symbol('output');
// Output goes to terminal.
const terminalScreen = exports.terminalScreen = (() => {
  let isTTY = !!process.stdout.isTTY;
  let ttyWidth = process.stdout.columns || 0;
  if (process.env.PLAYWRIGHT_FORCE_TTY === 'false' || process.env.PLAYWRIGHT_FORCE_TTY === '0') {
    isTTY = false;
    ttyWidth = 0;
  } else if (process.env.PLAYWRIGHT_FORCE_TTY === 'true' || process.env.PLAYWRIGHT_FORCE_TTY === '1') {
    isTTY = true;
    ttyWidth = process.stdout.columns || 100;
  } else if (process.env.PLAYWRIGHT_FORCE_TTY) {
    isTTY = true;
    ttyWidth = +process.env.PLAYWRIGHT_FORCE_TTY;
    if (isNaN(ttyWidth)) ttyWidth = 100;
  }
  let useColors = isTTY;
  if (process.env.DEBUG_COLORS === '0' || process.env.DEBUG_COLORS === 'false' || process.env.FORCE_COLOR === '0' || process.env.FORCE_COLOR === 'false') useColors = false;else if (process.env.DEBUG_COLORS || process.env.FORCE_COLOR) useColors = true;
  const colors = useColors ? _utils.colors : _utils.noColors;
  return {
    resolveFiles: 'cwd',
    isTTY,
    ttyWidth,
    colors
  };
})();

// Output does not go to terminal, but colors are controlled with terminal env vars.
const nonTerminalScreen = exports.nonTerminalScreen = {
  colors: terminalScreen.colors,
  isTTY: false,
  ttyWidth: 0,
  resolveFiles: 'rootDir'
};

// Internal output for post-processing, should always contain real colors.
const internalScreen = exports.internalScreen = {
  colors: _utils.colors,
  isTTY: false,
  ttyWidth: 0,
  resolveFiles: 'rootDir'
};
class TerminalReporter {
  constructor(options = {}) {
    this.screen = terminalScreen;
    this.config = void 0;
    this.suite = void 0;
    this.totalTestCount = 0;
    this.result = void 0;
    this.fileDurations = new Map();
    this._omitFailures = void 0;
    this._fatalErrors = [];
    this._failureCount = 0;
    this._omitFailures = options.omitFailures || false;
  }
  version() {
    return 'v2';
  }
  onConfigure(config) {
    this.config = config;
  }
  onBegin(suite) {
    this.suite = suite;
    this.totalTestCount = suite.allTests().length;
  }
  onStdOut(chunk, test, result) {
    this._appendOutput({
      chunk,
      type: 'stdout'
    }, result);
  }
  onStdErr(chunk, test, result) {
    this._appendOutput({
      chunk,
      type: 'stderr'
    }, result);
  }
  _appendOutput(output, result) {
    if (!result) return;
    result[kOutputSymbol] = result[kOutputSymbol] || [];
    result[kOutputSymbol].push(output);
  }
  onTestEnd(test, result) {
    if (result.status !== 'skipped' && result.status !== test.expectedStatus) ++this._failureCount;
    const projectName = test.titlePath()[1];
    const relativePath = relativeTestPath(this.screen, this.config, test);
    const fileAndProject = (projectName ? `[${projectName}] › ` : '') + relativePath;
    const entry = this.fileDurations.get(fileAndProject) || {
      duration: 0,
      workers: new Set()
    };
    entry.duration += result.duration;
    entry.workers.add(result.workerIndex);
    this.fileDurations.set(fileAndProject, entry);
  }
  onError(error) {
    this._fatalErrors.push(error);
  }
  async onEnd(result) {
    this.result = result;
  }
  fitToScreen(line, prefix) {
    if (!this.screen.ttyWidth) {
      // Guard against the case where we cannot determine available width.
      return line;
    }
    return fitToWidth(line, this.screen.ttyWidth, prefix);
  }
  generateStartingMessage() {
    var _this$config$metadata;
    const jobs = (_this$config$metadata = this.config.metadata.actualWorkers) !== null && _this$config$metadata !== void 0 ? _this$config$metadata : this.config.workers;
    const shardDetails = this.config.shard ? `, shard ${this.config.shard.current} of ${this.config.shard.total}` : '';
    if (!this.totalTestCount) return '';
    return '\n' + this.screen.colors.dim('Running ') + this.totalTestCount + this.screen.colors.dim(` test${this.totalTestCount !== 1 ? 's' : ''} using `) + jobs + this.screen.colors.dim(` worker${jobs !== 1 ? 's' : ''}${shardDetails}`);
  }
  getSlowTests() {
    if (!this.config.reportSlowTests) return [];
    // Only pick durations that were served by single worker.
    const fileDurations = [...this.fileDurations.entries()].filter(([key, value]) => value.workers.size === 1).map(([key, value]) => [key, value.duration]);
    fileDurations.sort((a, b) => b[1] - a[1]);
    const count = Math.min(fileDurations.length, this.config.reportSlowTests.max || Number.POSITIVE_INFINITY);
    const threshold = this.config.reportSlowTests.threshold;
    return fileDurations.filter(([, duration]) => duration > threshold).slice(0, count);
  }
  generateSummaryMessage({
    didNotRun,
    skipped,
    expected,
    interrupted,
    unexpected,
    flaky,
    fatalErrors
  }) {
    const tokens = [];
    if (unexpected.length) {
      tokens.push(this.screen.colors.red(`  ${unexpected.length} failed`));
      for (const test of unexpected) tokens.push(this.screen.colors.red(this.formatTestHeader(test, {
        indent: '    '
      })));
    }
    if (interrupted.length) {
      tokens.push(this.screen.colors.yellow(`  ${interrupted.length} interrupted`));
      for (const test of interrupted) tokens.push(this.screen.colors.yellow(this.formatTestHeader(test, {
        indent: '    '
      })));
    }
    if (flaky.length) {
      tokens.push(this.screen.colors.yellow(`  ${flaky.length} flaky`));
      for (const test of flaky) tokens.push(this.screen.colors.yellow(this.formatTestHeader(test, {
        indent: '    '
      })));
    }
    if (skipped) tokens.push(this.screen.colors.yellow(`  ${skipped} skipped`));
    if (didNotRun) tokens.push(this.screen.colors.yellow(`  ${didNotRun} did not run`));
    if (expected) tokens.push(this.screen.colors.green(`  ${expected} passed`) + this.screen.colors.dim(` (${(0, _utilsBundle.ms)(this.result.duration)})`));
    if (fatalErrors.length && expected + unexpected.length + interrupted.length + flaky.length > 0) tokens.push(this.screen.colors.red(`  ${fatalErrors.length === 1 ? '1 error was not a part of any test' : fatalErrors.length + ' errors were not a part of any test'}, see above for details`));
    return tokens.join('\n');
  }
  generateSummary() {
    let didNotRun = 0;
    let skipped = 0;
    let expected = 0;
    const interrupted = [];
    const interruptedToPrint = [];
    const unexpected = [];
    const flaky = [];
    this.suite.allTests().forEach(test => {
      switch (test.outcome()) {
        case 'skipped':
          {
            if (test.results.some(result => result.status === 'interrupted')) {
              if (test.results.some(result => !!result.error)) interruptedToPrint.push(test);
              interrupted.push(test);
            } else if (!test.results.length || test.expectedStatus !== 'skipped') {
              ++didNotRun;
            } else {
              ++skipped;
            }
            break;
          }
        case 'expected':
          ++expected;
          break;
        case 'unexpected':
          unexpected.push(test);
          break;
        case 'flaky':
          flaky.push(test);
          break;
      }
    });
    const failuresToPrint = [...unexpected, ...flaky, ...interruptedToPrint];
    return {
      didNotRun,
      skipped,
      expected,
      interrupted,
      unexpected,
      flaky,
      failuresToPrint,
      fatalErrors: this._fatalErrors
    };
  }
  epilogue(full) {
    const summary = this.generateSummary();
    const summaryMessage = this.generateSummaryMessage(summary);
    if (full && summary.failuresToPrint.length && !this._omitFailures) this._printFailures(summary.failuresToPrint);
    this._printSlowTests();
    // TODO: 1.52: Make warning display prettier
    // this._printWarnings();
    this._printSummary(summaryMessage);
  }
  _printFailures(failures) {
    console.log('');
    failures.forEach((test, index) => {
      console.log(this.formatFailure(test, index + 1));
    });
  }
  _printSlowTests() {
    const slowTests = this.getSlowTests();
    slowTests.forEach(([file, duration]) => {
      console.log(this.screen.colors.yellow('  Slow test file: ') + file + this.screen.colors.yellow(` (${(0, _utilsBundle.ms)(duration)})`));
    });
    if (slowTests.length) console.log(this.screen.colors.yellow('  Consider running tests from slow files in parallel, see https://playwright.dev/docs/test-parallel.'));
  }
  _printWarnings() {
    const warningTests = this.suite.allTests().filter(test => test.annotations.some(a => a.type === 'warning'));
    const encounteredWarnings = new Map();
    for (const test of warningTests) {
      for (const annotation of test.annotations) {
        if (annotation.type !== 'warning' || annotation.description === undefined) continue;
        let tests = encounteredWarnings.get(annotation.description);
        if (!tests) {
          tests = [];
          encounteredWarnings.set(annotation.description, tests);
        }
        tests.push(test);
      }
    }
    for (const [description, tests] of encounteredWarnings) {
      console.log(this.screen.colors.yellow('  Warning: ') + description);
      for (const test of tests) console.log(this.formatTestHeader(test, {
        indent: '    ',
        mode: 'default'
      }));
    }
  }
  _printSummary(summary) {
    if (summary.trim()) console.log(summary);
  }
  willRetry(test) {
    return test.outcome() === 'unexpected' && test.results.length <= test.retries;
  }
  formatTestTitle(test, step, omitLocation = false) {
    return formatTestTitle(this.screen, this.config, test, step, omitLocation);
  }
  formatTestHeader(test, options = {}) {
    return formatTestHeader(this.screen, this.config, test, options);
  }
  formatFailure(test, index) {
    return formatFailure(this.screen, this.config, test, index);
  }
  formatError(error) {
    return formatError(this.screen, error);
  }
}
exports.TerminalReporter = TerminalReporter;
function formatFailure(screen, config, test, index) {
  const lines = [];
  const header = formatTestHeader(screen, config, test, {
    indent: '  ',
    index,
    mode: 'error'
  });
  lines.push(screen.colors.red(header));
  for (const result of test.results) {
    const resultLines = [];
    const errors = formatResultFailure(screen, test, result, '    ');
    if (!errors.length) continue;
    const retryLines = [];
    if (result.retry) {
      retryLines.push('');
      retryLines.push(screen.colors.gray(separator(screen, `    Retry #${result.retry}`)));
    }
    resultLines.push(...retryLines);
    resultLines.push(...errors.map(error => '\n' + error.message));
    for (let i = 0; i < result.attachments.length; ++i) {
      const attachment = result.attachments[i];
      if (attachment.name.startsWith('_')) continue;
      const hasPrintableContent = attachment.contentType.startsWith('text/');
      if (!attachment.path && !hasPrintableContent) continue;
      resultLines.push('');
      resultLines.push(screen.colors.cyan(separator(screen, `    attachment #${i + 1}: ${attachment.name} (${attachment.contentType})`)));
      if (attachment.path) {
        const relativePath = _path.default.relative(process.cwd(), attachment.path);
        resultLines.push(screen.colors.cyan(`    ${relativePath}`));
        // Make this extensible
        if (attachment.name === 'trace') {
          const packageManagerCommand = (0, _utils.getPackageManagerExecCommand)();
          resultLines.push(screen.colors.cyan(`    Usage:`));
          resultLines.push('');
          resultLines.push(screen.colors.cyan(`        ${packageManagerCommand} playwright show-trace ${quotePathIfNeeded(relativePath)}`));
          resultLines.push('');
        }
      } else {
        if (attachment.contentType.startsWith('text/') && attachment.body) {
          let text = attachment.body.toString();
          if (text.length > 300) text = text.slice(0, 300) + '...';
          for (const line of text.split('\n')) resultLines.push(screen.colors.cyan(`    ${line}`));
        }
      }
      resultLines.push(screen.colors.cyan(separator(screen, '   ')));
    }
    lines.push(...resultLines);
  }
  lines.push('');
  return lines.join('\n');
}
function formatRetry(screen, result) {
  const retryLines = [];
  if (result.retry) {
    retryLines.push('');
    retryLines.push(screen.colors.gray(separator(screen, `    Retry #${result.retry}`)));
  }
  return retryLines;
}
function quotePathIfNeeded(path) {
  if (/\s/.test(path)) return `"${path}"`;
  return path;
}
function formatResultFailure(screen, test, result, initialIndent) {
  const errorDetails = [];
  if (result.status === 'passed' && test.expectedStatus === 'failed') {
    errorDetails.push({
      message: indent(screen.colors.red(`Expected to fail, but passed.`), initialIndent)
    });
  }
  if (result.status === 'interrupted') {
    errorDetails.push({
      message: indent(screen.colors.red(`Test was interrupted.`), initialIndent)
    });
  }
  for (const error of result.errors) {
    const formattedError = formatError(screen, error);
    errorDetails.push({
      message: indent(formattedError.message, initialIndent),
      location: formattedError.location
    });
  }
  return errorDetails;
}
function relativeFilePath(screen, config, file) {
  if (screen.resolveFiles === 'cwd') return _path.default.relative(process.cwd(), file);
  return _path.default.relative(config.rootDir, file);
}
function relativeTestPath(screen, config, test) {
  return relativeFilePath(screen, config, test.location.file);
}
function stepSuffix(step) {
  const stepTitles = step ? step.titlePath() : [];
  return stepTitles.map(t => t.split('\n')[0]).map(t => ' › ' + t).join('');
}
function formatTestTitle(screen, config, test, step, omitLocation = false) {
  // root, project, file, ...describes, test
  const [, projectName,, ...titles] = test.titlePath();
  let location;
  if (omitLocation) location = `${relativeTestPath(screen, config, test)}`;else location = `${relativeTestPath(screen, config, test)}:${test.location.line}:${test.location.column}`;
  const projectTitle = projectName ? `[${projectName}] › ` : '';
  const testTitle = `${projectTitle}${location} › ${titles.join(' › ')}`;
  const extraTags = test.tags.filter(t => !testTitle.includes(t));
  return `${testTitle}${stepSuffix(step)}${extraTags.length ? ' ' + extraTags.join(' ') : ''}`;
}
function formatTestHeader(screen, config, test, options = {}) {
  const title = formatTestTitle(screen, config, test);
  const header = `${options.indent || ''}${options.index ? options.index + ') ' : ''}${title}`;
  let fullHeader = header;

  // Render the path to the deepest failing test.step.
  if (options.mode === 'error') {
    const stepPaths = new Set();
    for (const result of test.results.filter(r => !!r.errors.length)) {
      const stepPath = [];
      const visit = steps => {
        const errors = steps.filter(s => s.error);
        if (errors.length > 1) return;
        if (errors.length === 1 && errors[0].category === 'test.step') {
          stepPath.push(errors[0].title);
          visit(errors[0].steps);
        }
      };
      visit(result.steps);
      stepPaths.add(['', ...stepPath].join(' › '));
    }
    fullHeader = header + (stepPaths.size === 1 ? stepPaths.values().next().value : '');
  }
  return separator(screen, fullHeader);
}
function formatError(screen, error) {
  const message = error.message || error.value || '';
  const stack = error.stack;
  if (!stack && !error.location) return {
    message
  };
  const tokens = [];

  // Now that we filter out internals from our stack traces, we can safely render
  // the helper / original exception locations.
  const parsedStack = stack ? prepareErrorStack(stack) : undefined;
  tokens.push((parsedStack === null || parsedStack === void 0 ? void 0 : parsedStack.message) || message);
  if (error.snippet) {
    let snippet = error.snippet;
    if (!screen.colors.enabled) snippet = (0, _util.stripAnsiEscapes)(snippet);
    tokens.push('');
    tokens.push(snippet);
  }
  if (parsedStack && parsedStack.stackLines.length) tokens.push(screen.colors.dim(parsedStack.stackLines.join('\n')));
  let location = error.location;
  if (parsedStack && !location) location = parsedStack.location;
  if (error.cause) tokens.push(screen.colors.dim('[cause]: ') + formatError(screen, error.cause).message);
  return {
    location,
    message: tokens.join('\n')
  };
}
function separator(screen, text = '') {
  if (text) text += ' ';
  const columns = Math.min(100, screen.ttyWidth || 100);
  return text + screen.colors.dim('─'.repeat(Math.max(0, columns - text.length)));
}
function indent(lines, tab) {
  return lines.replace(/^(?=.+$)/gm, tab);
}
function prepareErrorStack(stack) {
  return (0, _utils.parseErrorStack)(stack, _path.default.sep, !!process.env.PWDEBUGIMPL);
}
function characterWidth(c) {
  return _utilsBundle2.getEastAsianWidth.eastAsianWidth(c.codePointAt(0));
}
function stringWidth(v) {
  let width = 0;
  for (const {
    segment
  } of new Intl.Segmenter(undefined, {
    granularity: 'grapheme'
  }).segment(v)) width += characterWidth(segment);
  return width;
}
function suffixOfWidth(v, width) {
  const segments = [...new Intl.Segmenter(undefined, {
    granularity: 'grapheme'
  }).segment(v)];
  let suffixBegin = v.length;
  for (const {
    segment,
    index
  } of segments.reverse()) {
    const segmentWidth = stringWidth(segment);
    if (segmentWidth > width) break;
    width -= segmentWidth;
    suffixBegin = index;
  }
  return v.substring(suffixBegin);
}

// Leaves enough space for the "prefix" to also fit.
function fitToWidth(line, width, prefix) {
  const prefixLength = prefix ? (0, _util.stripAnsiEscapes)(prefix).length : 0;
  width -= prefixLength;
  if (stringWidth(line) <= width) return line;

  // Even items are plain text, odd items are control sequences.
  const parts = line.split(_util.ansiRegex);
  const taken = [];
  for (let i = parts.length - 1; i >= 0; i--) {
    if (i % 2) {
      // Include all control sequences to preserve formatting.
      taken.push(parts[i]);
    } else {
      let part = suffixOfWidth(parts[i], width);
      const wasTruncated = part.length < parts[i].length;
      if (wasTruncated && parts[i].length > 0) {
        // Add ellipsis if we are truncating.
        part = '\u2026' + suffixOfWidth(parts[i], width - 1);
      }
      taken.push(part);
      width -= stringWidth(part);
    }
  }
  return taken.reverse().join('');
}
function resolveFromEnv(name) {
  const value = process.env[name];
  if (value) return _path.default.resolve(process.cwd(), value);
  return undefined;
}

// In addition to `outputFile` the function returns `outputDir` which should
// be cleaned up if present by some reporters contract.
function resolveOutputFile(reporterName, options) {
  var _ref, _process$env, _options$default;
  const name = reporterName.toUpperCase();
  let outputFile = resolveFromEnv(`PLAYWRIGHT_${name}_OUTPUT_FILE`);
  if (!outputFile && options.outputFile) outputFile = _path.default.resolve(options.configDir, options.outputFile);
  if (outputFile) return {
    outputFile
  };
  let outputDir = resolveFromEnv(`PLAYWRIGHT_${name}_OUTPUT_DIR`);
  if (!outputDir && options.outputDir) outputDir = _path.default.resolve(options.configDir, options.outputDir);
  if (!outputDir && options.default) outputDir = (0, _util.resolveReporterOutputPath)(options.default.outputDir, options.configDir, undefined);
  if (!outputDir) outputDir = options.configDir;
  const reportName = (_ref = (_process$env = process.env[`PLAYWRIGHT_${name}_OUTPUT_NAME`]) !== null && _process$env !== void 0 ? _process$env : options.fileName) !== null && _ref !== void 0 ? _ref : (_options$default = options.default) === null || _options$default === void 0 ? void 0 : _options$default.fileName;
  if (!reportName) return undefined;
  outputFile = _path.default.resolve(outputDir, reportName);
  return {
    outputFile,
    outputDir
  };
}