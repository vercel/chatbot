"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "program", {
  enumerable: true,
  get: function () {
    return _program.program;
  }
});
exports.withRunnerAndMutedWrite = withRunnerAndMutedWrite;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _program = require("playwright-core/lib/cli/program");
var _utils = require("playwright-core/lib/utils");
var _config = require("./common/config");
var _configLoader = require("./common/configLoader");
var _base = require("./reporters/base");
var _html = require("./reporters/html");
var _merge = require("./reporters/merge");
var _projectUtils = require("./runner/projectUtils");
var _runner = require("./runner/runner");
var testServer = _interopRequireWildcard(require("./runner/testServer"));
var _watchMode = require("./runner/watchMode");
var _util = require("./util");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
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

/* eslint-disable no-console */

function addTestCommand(program) {
  const command = program.command('test [test-filter...]');
  command.description('run tests with Playwright Test');
  const options = testOptions.sort((a, b) => a[0].replace(/-/g, '').localeCompare(b[0].replace(/-/g, '')));
  options.forEach(([name, description]) => command.option(name, description));
  command.action(async (args, opts) => {
    try {
      await runTests(args, opts);
    } catch (e) {
      console.error(e);
      (0, _utils.gracefullyProcessExitDoNotHang)(1);
    }
  });
  command.addHelpText('afterAll', `
Arguments [test-filter...]:
  Pass arguments to filter test files. Each argument is treated as a regular expression. Matching is performed against the absolute file paths.

Examples:
  $ npx playwright test my.spec.ts
  $ npx playwright test some.spec.ts:42
  $ npx playwright test --headed
  $ npx playwright test --project=webkit`);
}
function addListFilesCommand(program) {
  const command = program.command('list-files [file-filter...]', {
    hidden: true
  });
  command.description('List files with Playwright Test tests');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`);
  command.option('--project <project-name...>', `Only run tests from the specified list of projects, supports '*' wildcard (default: list all projects)`);
  command.action(async (args, opts) => listTestFiles(opts));
}
function addClearCacheCommand(program) {
  const command = program.command('clear-cache');
  command.description('clears build and test caches');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`);
  command.action(async opts => {
    const config = await (0, _configLoader.loadConfigFromFileRestartIfNeeded)(opts.config);
    if (!config) return;
    const runner = new _runner.Runner(config);
    const {
      status
    } = await runner.clearCache();
    const exitCode = status === 'interrupted' ? 130 : status === 'passed' ? 0 : 1;
    (0, _utils.gracefullyProcessExitDoNotHang)(exitCode);
  });
}
function addFindRelatedTestFilesCommand(program) {
  const command = program.command('find-related-test-files [source-files...]', {
    hidden: true
  });
  command.description('Returns the list of related tests to the given files');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`);
  command.action(async (files, options) => {
    const resolvedFiles = files.map(file => _path.default.resolve(process.cwd(), file));
    await withRunnerAndMutedWrite(options.config, runner => runner.findRelatedTestFiles(resolvedFiles));
  });
}
function addDevServerCommand(program) {
  const command = program.command('dev-server', {
    hidden: true
  });
  command.description('start dev server');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`);
  command.action(async options => {
    const config = await (0, _configLoader.loadConfigFromFileRestartIfNeeded)(options.config);
    if (!config) return;
    const runner = new _runner.Runner(config);
    const {
      status
    } = await runner.runDevServer();
    const exitCode = status === 'interrupted' ? 130 : status === 'passed' ? 0 : 1;
    (0, _utils.gracefullyProcessExitDoNotHang)(exitCode);
  });
}
function addTestServerCommand(program) {
  const command = program.command('test-server', {
    hidden: true
  });
  command.description('start test server');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`);
  command.option('--host <host>', 'Host to start the server on', 'localhost');
  command.option('--port <port>', 'Port to start the server on', '0');
  command.action(opts => runTestServer(opts));
}
function addShowReportCommand(program) {
  const command = program.command('show-report [report]');
  command.description('show HTML report');
  command.action((report, options) => (0, _html.showHTMLReport)(report, options.host, +options.port));
  command.option('--host <host>', 'Host to serve report on', 'localhost');
  command.option('--port <port>', 'Port to serve report on', '9323');
  command.addHelpText('afterAll', `
Arguments [report]:
  When specified, opens given report, otherwise opens last generated report.

Examples:
  $ npx playwright show-report
  $ npx playwright show-report playwright-report`);
}
function addMergeReportsCommand(program) {
  const command = program.command('merge-reports [dir]');
  command.description('merge multiple blob reports (for sharded tests) into a single report');
  command.action(async (dir, options) => {
    try {
      await mergeReports(dir, options);
    } catch (e) {
      console.error(e);
      (0, _utils.gracefullyProcessExitDoNotHang)(1);
    }
  });
  command.option('-c, --config <file>', `Configuration file. Can be used to specify additional configuration for the output report.`);
  command.option('--reporter <reporter>', `Reporter to use, comma-separated, can be ${_config.builtInReporters.map(name => `"${name}"`).join(', ')} (default: "${_config.defaultReporter}")`);
  command.addHelpText('afterAll', `
Arguments [dir]:
  Directory containing blob reports.

Examples:
  $ npx playwright merge-reports playwright-report`);
}
async function runTests(args, opts) {
  await (0, _utils.startProfiling)();
  const cliOverrides = overridesFromOptions(opts);
  const config = await (0, _configLoader.loadConfigFromFileRestartIfNeeded)(opts.config, cliOverrides, opts.deps === false);
  if (!config) return;
  config.cliArgs = args;
  config.cliGrep = opts.grep;
  config.cliOnlyChanged = opts.onlyChanged === true ? 'HEAD' : opts.onlyChanged;
  config.cliGrepInvert = opts.grepInvert;
  config.cliListOnly = !!opts.list;
  config.cliProjectFilter = opts.project || undefined;
  config.cliPassWithNoTests = !!opts.passWithNoTests;
  config.cliFailOnFlakyTests = !!opts.failOnFlakyTests;
  config.cliLastFailed = !!opts.lastFailed;

  // Evaluate project filters against config before starting execution. This enables a consistent error message across run modes
  (0, _projectUtils.filterProjects)(config.projects, config.cliProjectFilter);
  if (opts.ui || opts.uiHost || opts.uiPort) {
    if (opts.onlyChanged) throw new Error(`--only-changed is not supported in UI mode. If you'd like that to change, see https://github.com/microsoft/playwright/issues/15075 for more details.`);
    const status = await testServer.runUIMode(opts.config, cliOverrides, {
      host: opts.uiHost,
      port: opts.uiPort ? +opts.uiPort : undefined,
      args,
      grep: opts.grep,
      grepInvert: opts.grepInvert,
      project: opts.project || undefined,
      reporter: Array.isArray(opts.reporter) ? opts.reporter : opts.reporter ? [opts.reporter] : undefined
    });
    await (0, _utils.stopProfiling)('runner');
    if (status === 'restarted') return;
    const exitCode = status === 'interrupted' ? 130 : status === 'passed' ? 0 : 1;
    (0, _utils.gracefullyProcessExitDoNotHang)(exitCode);
    return;
  }
  if (process.env.PWTEST_WATCH) {
    if (opts.onlyChanged) throw new Error(`--only-changed is not supported in watch mode. If you'd like that to change, file an issue and let us know about your usecase for it.`);
    const status = await (0, _watchMode.runWatchModeLoop)((0, _configLoader.resolveConfigLocation)(opts.config), {
      projects: opts.project,
      files: args,
      grep: opts.grep
    });
    await (0, _utils.stopProfiling)('runner');
    if (status === 'restarted') return;
    const exitCode = status === 'interrupted' ? 130 : status === 'passed' ? 0 : 1;
    (0, _utils.gracefullyProcessExitDoNotHang)(exitCode);
    return;
  }
  const runner = new _runner.Runner(config);
  const status = await runner.runAllTests();
  await (0, _utils.stopProfiling)('runner');
  const exitCode = status === 'interrupted' ? 130 : status === 'passed' ? 0 : 1;
  (0, _utils.gracefullyProcessExitDoNotHang)(exitCode);
}
async function runTestServer(opts) {
  const host = opts.host || 'localhost';
  const port = opts.port ? +opts.port : 0;
  const status = await testServer.runTestServer(opts.config, {}, {
    host,
    port
  });
  if (status === 'restarted') return;
  const exitCode = status === 'interrupted' ? 130 : status === 'passed' ? 0 : 1;
  (0, _utils.gracefullyProcessExitDoNotHang)(exitCode);
}
async function withRunnerAndMutedWrite(configFile, callback) {
  // Redefine process.stdout.write in case config decides to pollute stdio.
  const stdoutWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (a, b, c) => process.stderr.write(a, b, c);
  try {
    const config = await (0, _configLoader.loadConfigFromFileRestartIfNeeded)(configFile);
    if (!config) return;
    const runner = new _runner.Runner(config);
    const result = await callback(runner);
    stdoutWrite(JSON.stringify(result, undefined, 2), () => {
      (0, _utils.gracefullyProcessExitDoNotHang)(0);
    });
  } catch (e) {
    const error = (0, _util.serializeError)(e);
    error.location = (0, _base.prepareErrorStack)(e.stack).location;
    stdoutWrite(JSON.stringify({
      error
    }, undefined, 2), () => {
      (0, _utils.gracefullyProcessExitDoNotHang)(0);
    });
  }
}
async function listTestFiles(opts) {
  await withRunnerAndMutedWrite(opts.config, async runner => {
    return await runner.listTestFiles();
  });
}
async function mergeReports(reportDir, opts) {
  const configFile = opts.config;
  const config = configFile ? await (0, _configLoader.loadConfigFromFileRestartIfNeeded)(configFile) : await (0, _configLoader.loadEmptyConfigForMergeReports)();
  if (!config) return;
  const dir = _path.default.resolve(process.cwd(), reportDir || '');
  const dirStat = await _fs.default.promises.stat(dir).catch(e => null);
  if (!dirStat) throw new Error('Directory does not exist: ' + dir);
  if (!dirStat.isDirectory()) throw new Error(`"${dir}" is not a directory`);
  let reporterDescriptions = resolveReporterOption(opts.reporter);
  if (!reporterDescriptions && configFile) reporterDescriptions = config.config.reporter;
  if (!reporterDescriptions) reporterDescriptions = [[_config.defaultReporter]];
  const rootDirOverride = configFile ? config.config.rootDir : undefined;
  await (0, _merge.createMergedReport)(config, dir, reporterDescriptions, rootDirOverride);
  (0, _utils.gracefullyProcessExitDoNotHang)(0);
}
function overridesFromOptions(options) {
  let updateSnapshots;
  if (['all', 'changed', 'missing', 'none'].includes(options.updateSnapshots)) updateSnapshots = options.updateSnapshots;else updateSnapshots = 'updateSnapshots' in options ? 'changed' : undefined;
  const overrides = {
    forbidOnly: options.forbidOnly ? true : undefined,
    fullyParallel: options.fullyParallel ? true : undefined,
    globalTimeout: options.globalTimeout ? parseInt(options.globalTimeout, 10) : undefined,
    maxFailures: options.x ? 1 : options.maxFailures ? parseInt(options.maxFailures, 10) : undefined,
    outputDir: options.output ? _path.default.resolve(process.cwd(), options.output) : undefined,
    quiet: options.quiet ? options.quiet : undefined,
    repeatEach: options.repeatEach ? parseInt(options.repeatEach, 10) : undefined,
    retries: options.retries ? parseInt(options.retries, 10) : undefined,
    reporter: resolveReporterOption(options.reporter),
    shard: resolveShardOption(options.shard),
    timeout: options.timeout ? parseInt(options.timeout, 10) : undefined,
    tsconfig: options.tsconfig ? _path.default.resolve(process.cwd(), options.tsconfig) : undefined,
    ignoreSnapshots: options.ignoreSnapshots ? !!options.ignoreSnapshots : undefined,
    updateSnapshots,
    updateSourceMethod: options.updateSourceMethod,
    workers: options.workers
  };
  if (options.browser) {
    const browserOpt = options.browser.toLowerCase();
    if (!['all', 'chromium', 'firefox', 'webkit'].includes(browserOpt)) throw new Error(`Unsupported browser "${options.browser}", must be one of "all", "chromium", "firefox" or "webkit"`);
    const browserNames = browserOpt === 'all' ? ['chromium', 'firefox', 'webkit'] : [browserOpt];
    overrides.projects = browserNames.map(browserName => {
      return {
        name: browserName,
        use: {
          browserName
        }
      };
    });
  }
  if (options.headed || options.debug) overrides.use = {
    headless: false
  };
  if (!options.ui && options.debug) {
    overrides.debug = true;
    process.env.PWDEBUG = '1';
  }
  if (!options.ui && options.trace) {
    if (!kTraceModes.includes(options.trace)) throw new Error(`Unsupported trace mode "${options.trace}", must be one of ${kTraceModes.map(mode => `"${mode}"`).join(', ')}`);
    overrides.use = overrides.use || {};
    overrides.use.trace = options.trace;
  }
  if (overrides.tsconfig && !_fs.default.existsSync(overrides.tsconfig)) throw new Error(`--tsconfig "${options.tsconfig}" does not exist`);
  return overrides;
}
function resolveReporterOption(reporter) {
  if (!reporter || !reporter.length) return undefined;
  return reporter.split(',').map(r => [resolveReporter(r)]);
}
function resolveShardOption(shard) {
  if (!shard) return undefined;
  const shardPair = shard.split('/');
  if (shardPair.length !== 2) {
    throw new Error(`--shard "${shard}", expected format is "current/all", 1-based, for example "3/5".`);
  }
  const current = parseInt(shardPair[0], 10);
  const total = parseInt(shardPair[1], 10);
  if (isNaN(total) || total < 1) throw new Error(`--shard "${shard}" total must be a positive number`);
  if (isNaN(current) || current < 1 || current > total) {
    throw new Error(`--shard "${shard}" current must be a positive number, not greater than shard total`);
  }
  return {
    current,
    total
  };
}
function resolveReporter(id) {
  if (_config.builtInReporters.includes(id)) return id;
  const localPath = _path.default.resolve(process.cwd(), id);
  if (_fs.default.existsSync(localPath)) return localPath;
  return require.resolve(id, {
    paths: [process.cwd()]
  });
}
const kTraceModes = ['on', 'off', 'on-first-retry', 'on-all-retries', 'retain-on-failure', 'retain-on-first-failure'];

// Note: update docs/src/test-cli-js.md when you update this, program is the source of truth.

const testOptions = [/* deprecated */['--browser <browser>', `Browser to use for tests, one of "all", "chromium", "firefox" or "webkit" (default: "chromium")`], ['-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`], ['--debug', `Run tests with Playwright Inspector. Shortcut for "PWDEBUG=1" environment variable and "--timeout=0 --max-failures=1 --headed --workers=1" options`], ['--fail-on-flaky-tests', `Fail if any test is flagged as flaky (default: false)`], ['--forbid-only', `Fail if test.only is called (default: false)`], ['--fully-parallel', `Run all tests in parallel (default: false)`], ['--global-timeout <timeout>', `Maximum time this test suite can run in milliseconds (default: unlimited)`], ['-g, --grep <grep>', `Only run tests matching this regular expression (default: ".*")`], ['-gv, --grep-invert <grep>', `Only run tests that do not match this regular expression`], ['--headed', `Run tests in headed browsers (default: headless)`], ['--ignore-snapshots', `Ignore screenshot and snapshot expectations`], ['--last-failed', `Only re-run the failures`], ['--list', `Collect all the tests and report them, but do not run`], ['--max-failures <N>', `Stop after the first N failures`], ['--no-deps', 'Do not run project dependencies'], ['--output <dir>', `Folder for output artifacts (default: "test-results")`], ['--only-changed [ref]', `Only run test files that have been changed between 'HEAD' and 'ref'. Defaults to running all uncommitted changes. Only supports Git.`], ['--pass-with-no-tests', `Makes test run succeed even if no tests were found`], ['--project <project-name...>', `Only run tests from the specified list of projects, supports '*' wildcard (default: run all projects)`], ['--quiet', `Suppress stdio`], ['--repeat-each <N>', `Run each test N times (default: 1)`], ['--reporter <reporter>', `Reporter to use, comma-separated, can be ${_config.builtInReporters.map(name => `"${name}"`).join(', ')} (default: "${_config.defaultReporter}")`], ['--retries <retries>', `Maximum retry count for flaky tests, zero for no retries (default: no retries)`], ['--shard <shard>', `Shard tests and execute only the selected shard, specify in the form "current/all", 1-based, for example "3/5"`], ['--timeout <timeout>', `Specify test timeout threshold in milliseconds, zero for unlimited (default: ${_config.defaultTimeout})`], ['--trace <mode>', `Force tracing mode, can be ${kTraceModes.map(mode => `"${mode}"`).join(', ')}`], ['--tsconfig <path>', `Path to a single tsconfig applicable to all imported files (default: look up tsconfig for each imported file separately)`], ['--ui', `Run tests in interactive UI mode`], ['--ui-host <host>', 'Host to serve UI on; specifying this option opens UI in a browser tab'], ['--ui-port <port>', 'Port to serve UI on, 0 for any free port; specifying this option opens UI in a browser tab'], ['-u, --update-snapshots [mode]', `Update snapshots with actual results. Possible values are "all", "changed", "missing", and "none". Running tests without the flag defaults to "missing"; running tests with the flag but without a value defaults to "changed".`], ['--update-source-method <method>', `Chooses the way source is updated. Possible values are 'overwrite', '3way' and 'patch'. Defaults to 'patch'`], ['-j, --workers <workers>', `Number of concurrent workers or percentage of logical CPU cores, use 1 to run in a single worker (default: 50%)`], ['-x', `Stop after the first failure`]];
addTestCommand(_program.program);
addShowReportCommand(_program.program);
addListFilesCommand(_program.program);
addMergeReportsCommand(_program.program);
addClearCacheCommand(_program.program);
addFindRelatedTestFilesCommand(_program.program);
addDevServerCommand(_program.program);
addTestServerCommand(_program.program);