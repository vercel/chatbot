"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
exports.showHTMLReport = showHTMLReport;
exports.startHtmlReportServer = startHtmlReportServer;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _stream = require("stream");
var _utils = require("playwright-core/lib/utils");
var _utilsBundle = require("playwright-core/lib/utilsBundle");
var _zipBundle = require("playwright-core/lib/zipBundle");
var _base = require("./base");
var _babelBundle = require("../transform/babelBundle");
var _util = require("../util");
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

const htmlReportOptions = ['always', 'never', 'on-failure'];
const isHtmlReportOption = type => {
  return htmlReportOptions.includes(type);
};
class HtmlReporter {
  constructor(options) {
    this.config = void 0;
    this.suite = void 0;
    this._options = void 0;
    this._outputFolder = void 0;
    this._attachmentsBaseURL = void 0;
    this._open = void 0;
    this._port = void 0;
    this._host = void 0;
    this._buildResult = void 0;
    this._topLevelErrors = [];
    this._options = options;
  }
  version() {
    return 'v2';
  }
  printsToStdio() {
    return false;
  }
  onConfigure(config) {
    this.config = config;
  }
  onBegin(suite) {
    const {
      outputFolder,
      open,
      attachmentsBaseURL,
      host,
      port
    } = this._resolveOptions();
    this._outputFolder = outputFolder;
    this._open = open;
    this._host = host;
    this._port = port;
    this._attachmentsBaseURL = attachmentsBaseURL;
    const reportedWarnings = new Set();
    for (const project of this.config.projects) {
      if (this._isSubdirectory(outputFolder, project.outputDir) || this._isSubdirectory(project.outputDir, outputFolder)) {
        const key = outputFolder + '|' + project.outputDir;
        if (reportedWarnings.has(key)) continue;
        reportedWarnings.add(key);
        console.log(_utils.colors.red(`Configuration Error: HTML reporter output folder clashes with the tests output folder:`));
        console.log(`
    html reporter folder: ${_utils.colors.bold(outputFolder)}
    test results folder: ${_utils.colors.bold(project.outputDir)}`);
        console.log('');
        console.log(`HTML reporter will clear its output directory prior to being generated, which will lead to the artifact loss.
`);
      }
    }
    this.suite = suite;
  }
  _resolveOptions() {
    var _reportFolderFromEnv;
    const outputFolder = (_reportFolderFromEnv = reportFolderFromEnv()) !== null && _reportFolderFromEnv !== void 0 ? _reportFolderFromEnv : (0, _util.resolveReporterOutputPath)('playwright-report', this._options.configDir, this._options.outputFolder);
    return {
      outputFolder,
      open: getHtmlReportOptionProcessEnv() || this._options.open || 'on-failure',
      attachmentsBaseURL: process.env.PLAYWRIGHT_HTML_ATTACHMENTS_BASE_URL || this._options.attachmentsBaseURL || 'data/',
      host: process.env.PLAYWRIGHT_HTML_HOST || this._options.host,
      port: process.env.PLAYWRIGHT_HTML_PORT ? +process.env.PLAYWRIGHT_HTML_PORT : this._options.port
    };
  }
  _isSubdirectory(parentDir, dir) {
    const relativePath = _path.default.relative(parentDir, dir);
    return !!relativePath && !relativePath.startsWith('..') && !_path.default.isAbsolute(relativePath);
  }
  onError(error) {
    this._topLevelErrors.push(error);
  }
  async onEnd(result) {
    const projectSuites = this.suite.suites;
    await (0, _utils.removeFolders)([this._outputFolder]);
    const builder = new HtmlBuilder(this.config, this._outputFolder, this._attachmentsBaseURL);
    this._buildResult = await builder.build(this.config.metadata, projectSuites, result, this._topLevelErrors);
  }
  async onExit() {
    if (process.env.CI || !this._buildResult) return;
    const {
      ok,
      singleTestId
    } = this._buildResult;
    const shouldOpen = !this._options._isTestServer && (this._open === 'always' || !ok && this._open === 'on-failure');
    if (shouldOpen) {
      await showHTMLReport(this._outputFolder, this._host, this._port, singleTestId);
    } else if (this._options._mode === 'test' && !this._options._isTestServer) {
      const packageManagerCommand = (0, _utils.getPackageManagerExecCommand)();
      const relativeReportPath = this._outputFolder === standaloneDefaultFolder() ? '' : ' ' + _path.default.relative(process.cwd(), this._outputFolder);
      const hostArg = this._host ? ` --host ${this._host}` : '';
      const portArg = this._port ? ` --port ${this._port}` : '';
      console.log('');
      console.log('To open last HTML report run:');
      console.log(_utils.colors.cyan(`
  ${packageManagerCommand} playwright show-report${relativeReportPath}${hostArg}${portArg}
`));
    }
  }
}
function reportFolderFromEnv() {
  // Note: PLAYWRIGHT_HTML_REPORT is for backwards compatibility.
  const envValue = process.env.PLAYWRIGHT_HTML_OUTPUT_DIR || process.env.PLAYWRIGHT_HTML_REPORT;
  return envValue ? _path.default.resolve(envValue) : undefined;
}
function getHtmlReportOptionProcessEnv() {
  // Note: PW_TEST_HTML_REPORT_OPEN is for backwards compatibility.
  const htmlOpenEnv = process.env.PLAYWRIGHT_HTML_OPEN || process.env.PW_TEST_HTML_REPORT_OPEN;
  if (!htmlOpenEnv) return undefined;
  if (!isHtmlReportOption(htmlOpenEnv)) {
    console.log(_utils.colors.red(`Configuration Error: HTML reporter Invalid value for PLAYWRIGHT_HTML_OPEN: ${htmlOpenEnv}. Valid values are: ${htmlReportOptions.join(', ')}`));
    return undefined;
  }
  return htmlOpenEnv;
}
function standaloneDefaultFolder() {
  var _reportFolderFromEnv2;
  return (_reportFolderFromEnv2 = reportFolderFromEnv()) !== null && _reportFolderFromEnv2 !== void 0 ? _reportFolderFromEnv2 : (0, _util.resolveReporterOutputPath)('playwright-report', process.cwd(), undefined);
}
async function showHTMLReport(reportFolder, host = 'localhost', port, testId) {
  const folder = reportFolder !== null && reportFolder !== void 0 ? reportFolder : standaloneDefaultFolder();
  try {
    (0, _utils.assert)(_fs.default.statSync(folder).isDirectory());
  } catch (e) {
    console.log(_utils.colors.red(`No report found at "${folder}"`));
    (0, _utils.gracefullyProcessExitDoNotHang)(1);
    return;
  }
  const server = startHtmlReportServer(folder);
  await server.start({
    port,
    host,
    preferredPort: port ? undefined : 9323
  });
  let url = server.urlPrefix('human-readable');
  console.log('');
  console.log(_utils.colors.cyan(`  Serving HTML report at ${url}. Press Ctrl+C to quit.`));
  if (testId) url += `#?testId=${testId}`;
  url = url.replace('0.0.0.0', 'localhost');
  await (0, _utilsBundle.open)(url, {
    wait: true
  }).catch(() => {});
  await new Promise(() => {});
}
function startHtmlReportServer(folder) {
  const server = new _utils.HttpServer();
  server.routePrefix('/', (request, response) => {
    let relativePath = new URL('http://localhost' + request.url).pathname;
    if (relativePath.startsWith('/trace/file')) {
      const url = new URL('http://localhost' + request.url);
      try {
        return server.serveFile(request, response, url.searchParams.get('path'));
      } catch (e) {
        return false;
      }
    }
    if (relativePath.endsWith('/stall.js')) return true;
    if (relativePath === '/') relativePath = '/index.html';
    const absolutePath = _path.default.join(folder, ...relativePath.split('/'));
    return server.serveFile(request, response, absolutePath);
  });
  return server;
}
class HtmlBuilder {
  constructor(config, outputDir, attachmentsBaseURL) {
    this._config = void 0;
    this._reportFolder = void 0;
    this._stepsInFile = new _utils.MultiMap();
    this._dataZipFile = void 0;
    this._hasTraces = false;
    this._attachmentsBaseURL = void 0;
    this._config = config;
    this._reportFolder = outputDir;
    _fs.default.mkdirSync(this._reportFolder, {
      recursive: true
    });
    this._dataZipFile = new _zipBundle.yazl.ZipFile();
    this._attachmentsBaseURL = attachmentsBaseURL;
  }
  async build(metadata, projectSuites, result, topLevelErrors) {
    const data = new Map();
    for (const projectSuite of projectSuites) {
      for (const fileSuite of projectSuite.suites) {
        const fileName = this._relativeLocation(fileSuite.location).file;
        const fileId = (0, _utils.calculateSha1)((0, _utils.toPosixPath)(fileName)).slice(0, 20);
        let fileEntry = data.get(fileId);
        if (!fileEntry) {
          fileEntry = {
            testFile: {
              fileId,
              fileName,
              tests: []
            },
            testFileSummary: {
              fileId,
              fileName,
              tests: [],
              stats: emptyStats()
            }
          };
          data.set(fileId, fileEntry);
        }
        const {
          testFile,
          testFileSummary
        } = fileEntry;
        const testEntries = [];
        this._processSuite(fileSuite, projectSuite.project().name, [], testEntries);
        for (const test of testEntries) {
          testFile.tests.push(test.testCase);
          testFileSummary.tests.push(test.testCaseSummary);
        }
      }
    }
    createSnippets(this._stepsInFile);
    let ok = true;
    for (const [fileId, {
      testFile,
      testFileSummary
    }] of data) {
      const stats = testFileSummary.stats;
      for (const test of testFileSummary.tests) {
        if (test.outcome === 'expected') ++stats.expected;
        if (test.outcome === 'skipped') ++stats.skipped;
        if (test.outcome === 'unexpected') ++stats.unexpected;
        if (test.outcome === 'flaky') ++stats.flaky;
        ++stats.total;
      }
      stats.ok = stats.unexpected + stats.flaky === 0;
      if (!stats.ok) ok = false;
      const testCaseSummaryComparator = (t1, t2) => {
        const w1 = (t1.outcome === 'unexpected' ? 1000 : 0) + (t1.outcome === 'flaky' ? 1 : 0);
        const w2 = (t2.outcome === 'unexpected' ? 1000 : 0) + (t2.outcome === 'flaky' ? 1 : 0);
        return w2 - w1;
      };
      testFileSummary.tests.sort(testCaseSummaryComparator);
      this._addDataFile(fileId + '.json', testFile);
    }
    const htmlReport = {
      metadata,
      startTime: result.startTime.getTime(),
      duration: result.duration,
      files: [...data.values()].map(e => e.testFileSummary),
      projectNames: projectSuites.map(r => r.project().name),
      stats: {
        ...[...data.values()].reduce((a, e) => addStats(a, e.testFileSummary.stats), emptyStats())
      },
      errors: topLevelErrors.map(error => (0, _base.formatError)(_base.internalScreen, error).message)
    };
    htmlReport.files.sort((f1, f2) => {
      const w1 = f1.stats.unexpected * 1000 + f1.stats.flaky;
      const w2 = f2.stats.unexpected * 1000 + f2.stats.flaky;
      return w2 - w1;
    });
    this._addDataFile('report.json', htmlReport);
    let singleTestId;
    if (htmlReport.stats.total === 1) {
      const testFile = data.values().next().value.testFile;
      singleTestId = testFile.tests[0].testId;
    }
    if (process.env.PW_HMR === '1') {
      const redirectFile = _path.default.join(this._reportFolder, 'index.html');
      await this._writeReportData(redirectFile);
      async function redirect() {
        const hmrURL = new URL('http://localhost:44224'); // dev server, port is harcoded in build.js
        const popup = window.open(hmrURL);
        window.addEventListener('message', evt => {
          if (evt.source === popup && evt.data === 'ready') {
            popup.postMessage(window.playwrightReportBase64, hmrURL.origin);
            window.close();
          }
        }, {
          once: true
        });
      }
      _fs.default.appendFileSync(redirectFile, `<script>(${redirect.toString()})()</script>`);
      return {
        ok,
        singleTestId
      };
    }

    // Copy app.
    const appFolder = _path.default.join(require.resolve('playwright-core'), '..', 'lib', 'vite', 'htmlReport');
    await (0, _utils.copyFileAndMakeWritable)(_path.default.join(appFolder, 'index.html'), _path.default.join(this._reportFolder, 'index.html'));

    // Copy trace viewer.
    if (this._hasTraces) {
      const traceViewerFolder = _path.default.join(require.resolve('playwright-core'), '..', 'lib', 'vite', 'traceViewer');
      const traceViewerTargetFolder = _path.default.join(this._reportFolder, 'trace');
      const traceViewerAssetsTargetFolder = _path.default.join(traceViewerTargetFolder, 'assets');
      _fs.default.mkdirSync(traceViewerAssetsTargetFolder, {
        recursive: true
      });
      for (const file of _fs.default.readdirSync(traceViewerFolder)) {
        if (file.endsWith('.map') || file.includes('watch') || file.includes('assets')) continue;
        await (0, _utils.copyFileAndMakeWritable)(_path.default.join(traceViewerFolder, file), _path.default.join(traceViewerTargetFolder, file));
      }
      for (const file of _fs.default.readdirSync(_path.default.join(traceViewerFolder, 'assets'))) {
        if (file.endsWith('.map') || file.includes('xtermModule')) continue;
        await (0, _utils.copyFileAndMakeWritable)(_path.default.join(traceViewerFolder, 'assets', file), _path.default.join(traceViewerAssetsTargetFolder, file));
      }
    }
    await this._writeReportData(_path.default.join(this._reportFolder, 'index.html'));
    return {
      ok,
      singleTestId
    };
  }
  async _writeReportData(filePath) {
    _fs.default.appendFileSync(filePath, '<script>\nwindow.playwrightReportBase64 = "data:application/zip;base64,');
    await new Promise(f => {
      this._dataZipFile.end(undefined, () => {
        this._dataZipFile.outputStream.pipe(new Base64Encoder()).pipe(_fs.default.createWriteStream(filePath, {
          flags: 'a'
        })).on('close', f);
      });
    });
    _fs.default.appendFileSync(filePath, '";</script>');
  }
  _addDataFile(fileName, data) {
    this._dataZipFile.addBuffer(Buffer.from(JSON.stringify(data)), fileName);
  }
  _processSuite(suite, projectName, path, outTests) {
    const newPath = [...path, suite.title];
    suite.entries().forEach(e => {
      if (e.type === 'test') outTests.push(this._createTestEntry(e, projectName, newPath));else this._processSuite(e, projectName, newPath, outTests);
    });
  }
  _createTestEntry(test, projectName, path) {
    const duration = test.results.reduce((a, r) => a + r.duration, 0);
    const location = this._relativeLocation(test.location);
    path = path.slice(1).filter(path => path.length > 0);
    const results = test.results.map(r => this._createTestResult(test, r));
    return {
      testCase: {
        testId: test.id,
        title: test.title,
        projectName,
        location,
        duration,
        // Annotations can be pushed directly, with a wrong type.
        annotations: test.annotations.map(a => ({
          type: a.type,
          description: a.description ? String(a.description) : a.description
        })),
        tags: test.tags,
        outcome: test.outcome(),
        path,
        results,
        ok: test.outcome() === 'expected' || test.outcome() === 'flaky'
      },
      testCaseSummary: {
        testId: test.id,
        title: test.title,
        projectName,
        location,
        duration,
        // Annotations can be pushed directly, with a wrong type.
        annotations: test.annotations.map(a => ({
          type: a.type,
          description: a.description ? String(a.description) : a.description
        })),
        tags: test.tags,
        outcome: test.outcome(),
        path,
        ok: test.outcome() === 'expected' || test.outcome() === 'flaky',
        results: results.map(result => {
          return {
            attachments: result.attachments.map(a => ({
              name: a.name,
              contentType: a.contentType,
              path: a.path
            }))
          };
        })
      }
    };
  }
  _serializeAttachments(attachments) {
    let lastAttachment;
    return attachments.map(a => {
      if (a.name === 'trace') this._hasTraces = true;
      if ((a.name === 'stdout' || a.name === 'stderr') && a.contentType === 'text/plain') {
        if (lastAttachment && lastAttachment.name === a.name && lastAttachment.contentType === a.contentType) {
          lastAttachment.body += (0, _util.stripAnsiEscapes)(a.body);
          return null;
        }
        a.body = (0, _util.stripAnsiEscapes)(a.body);
        lastAttachment = a;
        return a;
      }
      if (a.path) {
        let fileName = a.path;
        try {
          const buffer = _fs.default.readFileSync(a.path);
          const sha1 = (0, _utils.calculateSha1)(buffer) + _path.default.extname(a.path);
          fileName = this._attachmentsBaseURL + sha1;
          _fs.default.mkdirSync(_path.default.join(this._reportFolder, 'data'), {
            recursive: true
          });
          _fs.default.writeFileSync(_path.default.join(this._reportFolder, 'data', sha1), buffer);
        } catch (e) {}
        return {
          name: a.name,
          contentType: a.contentType,
          path: fileName,
          body: a.body
        };
      }
      if (a.body instanceof Buffer) {
        if (isTextContentType(a.contentType)) {
          var _a$contentType$match;
          // Content type is like this: "text/html; charset=UTF-8"
          const charset = (_a$contentType$match = a.contentType.match(/charset=(.*)/)) === null || _a$contentType$match === void 0 ? void 0 : _a$contentType$match[1];
          try {
            const body = a.body.toString(charset || 'utf-8');
            return {
              name: a.name,
              contentType: a.contentType,
              body
            };
          } catch (e) {
            // Invalid encoding, fall through and save to file.
          }
        }
        _fs.default.mkdirSync(_path.default.join(this._reportFolder, 'data'), {
          recursive: true
        });
        const extension = (0, _utils.sanitizeForFilePath)(_path.default.extname(a.name).replace(/^\./, '')) || _utilsBundle.mime.getExtension(a.contentType) || 'dat';
        const sha1 = (0, _utils.calculateSha1)(a.body) + '.' + extension;
        _fs.default.writeFileSync(_path.default.join(this._reportFolder, 'data', sha1), a.body);
        return {
          name: a.name,
          contentType: a.contentType,
          path: this._attachmentsBaseURL + sha1
        };
      }

      // string
      return {
        name: a.name,
        contentType: a.contentType,
        body: a.body
      };
    }).filter(Boolean);
  }
  _createTestResult(test, result) {
    return {
      duration: result.duration,
      startTime: result.startTime.toISOString(),
      retry: result.retry,
      steps: dedupeSteps(result.steps).map(s => this._createTestStep(s, result)),
      errors: (0, _base.formatResultFailure)(_base.internalScreen, test, result, '').map(error => error.message),
      status: result.status,
      attachments: this._serializeAttachments([...result.attachments, ...result.stdout.map(m => stdioAttachment(m, 'stdout')), ...result.stderr.map(m => stdioAttachment(m, 'stderr'))])
    };
  }
  _createTestStep(dedupedStep, result) {
    var _dedupedStep$step$ann, _step$error;
    const {
      step,
      duration,
      count
    } = dedupedStep;
    const skipped = (_dedupedStep$step$ann = dedupedStep.step.annotations) === null || _dedupedStep$step$ann === void 0 ? void 0 : _dedupedStep$step$ann.find(a => a.type === 'skip');
    let title = step.title;
    if (skipped) title = `${title} (skipped${skipped.description ? ': ' + skipped.description : ''})`;
    const testStep = {
      title,
      startTime: step.startTime.toISOString(),
      duration,
      steps: dedupeSteps(step.steps).map(s => this._createTestStep(s, result)),
      attachments: step.attachments.map(s => {
        const index = result.attachments.indexOf(s);
        if (index === -1) throw new Error('Unexpected, attachment not found');
        return index;
      }),
      location: this._relativeLocation(step.location),
      error: (_step$error = step.error) === null || _step$error === void 0 ? void 0 : _step$error.message,
      count,
      skipped: !!skipped
    };
    if (step.location) this._stepsInFile.set(step.location.file, testStep);
    return testStep;
  }
  _relativeLocation(location) {
    if (!location) return undefined;
    const file = (0, _utils.toPosixPath)(_path.default.relative(this._config.rootDir, location.file));
    return {
      file,
      line: location.line,
      column: location.column
    };
  }
}
const emptyStats = () => {
  return {
    total: 0,
    expected: 0,
    unexpected: 0,
    flaky: 0,
    skipped: 0,
    ok: true
  };
};
const addStats = (stats, delta) => {
  stats.total += delta.total;
  stats.skipped += delta.skipped;
  stats.expected += delta.expected;
  stats.unexpected += delta.unexpected;
  stats.flaky += delta.flaky;
  stats.ok = stats.ok && delta.ok;
  return stats;
};
class Base64Encoder extends _stream.Transform {
  constructor(...args) {
    super(...args);
    this._remainder = void 0;
  }
  _transform(chunk, encoding, callback) {
    if (this._remainder) {
      chunk = Buffer.concat([this._remainder, chunk]);
      this._remainder = undefined;
    }
    const remaining = chunk.length % 3;
    if (remaining) {
      this._remainder = chunk.slice(chunk.length - remaining);
      chunk = chunk.slice(0, chunk.length - remaining);
    }
    chunk = chunk.toString('base64');
    this.push(Buffer.from(chunk));
    callback();
  }
  _flush(callback) {
    if (this._remainder) this.push(Buffer.from(this._remainder.toString('base64')));
    callback();
  }
}
function isTextContentType(contentType) {
  return contentType.startsWith('text/') || contentType.startsWith('application/json');
}
function stdioAttachment(chunk, type) {
  return {
    name: type,
    contentType: 'text/plain',
    body: typeof chunk === 'string' ? chunk : chunk.toString('utf-8')
  };
}
function dedupeSteps(steps) {
  const result = [];
  let lastResult = undefined;
  for (const step of steps) {
    var _step$location, _lastResult, _step$location2, _lastStep$location, _step$location3, _lastStep$location2, _step$location4, _lastStep$location3;
    const canDedupe = !step.error && step.duration >= 0 && ((_step$location = step.location) === null || _step$location === void 0 ? void 0 : _step$location.file) && !step.steps.length;
    const lastStep = (_lastResult = lastResult) === null || _lastResult === void 0 ? void 0 : _lastResult.step;
    if (canDedupe && lastResult && lastStep && step.category === lastStep.category && step.title === lastStep.title && ((_step$location2 = step.location) === null || _step$location2 === void 0 ? void 0 : _step$location2.file) === ((_lastStep$location = lastStep.location) === null || _lastStep$location === void 0 ? void 0 : _lastStep$location.file) && ((_step$location3 = step.location) === null || _step$location3 === void 0 ? void 0 : _step$location3.line) === ((_lastStep$location2 = lastStep.location) === null || _lastStep$location2 === void 0 ? void 0 : _lastStep$location2.line) && ((_step$location4 = step.location) === null || _step$location4 === void 0 ? void 0 : _step$location4.column) === ((_lastStep$location3 = lastStep.location) === null || _lastStep$location3 === void 0 ? void 0 : _lastStep$location3.column)) {
      ++lastResult.count;
      lastResult.duration += step.duration;
      continue;
    }
    lastResult = {
      step,
      count: 1,
      duration: step.duration
    };
    result.push(lastResult);
    if (!canDedupe) lastResult = undefined;
  }
  return result;
}
function createSnippets(stepsInFile) {
  for (const file of stepsInFile.keys()) {
    let source;
    try {
      source = _fs.default.readFileSync(file, 'utf-8') + '\n//';
    } catch (e) {
      continue;
    }
    const lines = source.split('\n').length;
    const highlighted = (0, _babelBundle.codeFrameColumns)(source, {
      start: {
        line: lines,
        column: 1
      }
    }, {
      highlightCode: true,
      linesAbove: lines,
      linesBelow: 0
    });
    const highlightedLines = highlighted.split('\n');
    const lineWithArrow = highlightedLines[highlightedLines.length - 1];
    for (const step of stepsInFile.get(file)) {
      // Don't bother with snippets that have less than 3 lines.
      if (step.location.line < 2 || step.location.line >= lines) continue;
      // Cut out snippet.
      const snippetLines = highlightedLines.slice(step.location.line - 2, step.location.line + 1);
      // Relocate arrow.
      const index = lineWithArrow.indexOf('^');
      const shiftedArrow = lineWithArrow.slice(0, index) + ' '.repeat(step.location.column - 1) + lineWithArrow.slice(index);
      // Insert arrow line.
      snippetLines.splice(2, 0, shiftedArrow);
      step.snippet = snippetLines.join('\n');
    }
  }
}
var _default = exports.default = HtmlReporter;