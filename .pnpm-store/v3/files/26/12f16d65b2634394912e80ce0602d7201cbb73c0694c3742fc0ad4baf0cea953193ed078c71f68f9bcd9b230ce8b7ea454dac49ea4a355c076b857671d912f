"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TestStepInfoImpl = exports.TestSkipError = exports.TestInfoImpl = exports.StepSkipError = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _utils = require("playwright-core/lib/utils");
var _timeoutManager = require("./timeoutManager");
var _util = require("../util");
var _testTracing = require("./testTracing");
var _util2 = require("./util");
var _floatingPromiseScope = require("./floatingPromiseScope");
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

class TestInfoImpl {
  get error() {
    return this.errors[0];
  }
  set error(e) {
    if (e === undefined) throw new Error('Cannot assign testInfo.error undefined value!');
    this.errors[0] = e;
  }
  get timeout() {
    return this._timeoutManager.defaultSlot().timeout;
  }
  set timeout(timeout) {
    // Ignored.
  }
  _deadlineForMatcher(timeout) {
    const startTime = (0, _utils.monotonicTime)();
    const matcherDeadline = timeout ? startTime + timeout : _timeoutManager.kMaxDeadline;
    const testDeadline = this._timeoutManager.currentSlotDeadline() - 250;
    const matcherMessage = `Timeout ${timeout}ms exceeded while waiting on the predicate`;
    const testMessage = `Test timeout of ${this.timeout}ms exceeded`;
    return {
      deadline: Math.min(testDeadline, matcherDeadline),
      timeoutMessage: testDeadline < matcherDeadline ? testMessage : matcherMessage
    };
  }
  static _defaultDeadlineForMatcher(timeout) {
    return {
      deadline: timeout ? (0, _utils.monotonicTime)() + timeout : 0,
      timeoutMessage: `Timeout ${timeout}ms exceeded while waiting on the predicate`
    };
  }
  constructor(configInternal, projectInternal, workerParams, test, retry, onStepBegin, onStepEnd, onAttach) {
    var _test$id, _test$_requireFile, _test$title, _test$titlePath, _test$location$file, _test$location$line, _test$location$column, _test$tags, _test$fn, _test$expectedStatus;
    this._onStepBegin = void 0;
    this._onStepEnd = void 0;
    this._onAttach = void 0;
    this._timeoutManager = void 0;
    this._startTime = void 0;
    this._startWallTime = void 0;
    this._tracing = void 0;
    this._floatingPromiseScope = new _floatingPromiseScope.FloatingPromiseScope();
    this._wasInterrupted = false;
    this._lastStepId = 0;
    this._requireFile = void 0;
    this._projectInternal = void 0;
    this._configInternal = void 0;
    this._steps = [];
    this._stepMap = new Map();
    this._onDidFinishTestFunction = void 0;
    this._hasNonRetriableError = false;
    this._hasUnhandledError = false;
    this._allowSkips = false;
    // ------------ TestInfo fields ------------
    this.testId = void 0;
    this.repeatEachIndex = void 0;
    this.retry = void 0;
    this.workerIndex = void 0;
    this.parallelIndex = void 0;
    this.project = void 0;
    this.config = void 0;
    this.title = void 0;
    this.titlePath = void 0;
    this.file = void 0;
    this.line = void 0;
    this.tags = void 0;
    this.column = void 0;
    this.fn = void 0;
    this.expectedStatus = void 0;
    this.duration = 0;
    this.annotations = [];
    this.attachments = [];
    this.status = 'passed';
    this.snapshotSuffix = '';
    this.outputDir = void 0;
    this.snapshotDir = void 0;
    this.errors = [];
    this._attachmentsPush = void 0;
    this.testId = (_test$id = test === null || test === void 0 ? void 0 : test.id) !== null && _test$id !== void 0 ? _test$id : '';
    this._onStepBegin = onStepBegin;
    this._onStepEnd = onStepEnd;
    this._onAttach = onAttach;
    this._startTime = (0, _utils.monotonicTime)();
    this._startWallTime = Date.now();
    this._requireFile = (_test$_requireFile = test === null || test === void 0 ? void 0 : test._requireFile) !== null && _test$_requireFile !== void 0 ? _test$_requireFile : '';
    this.repeatEachIndex = workerParams.repeatEachIndex;
    this.retry = retry;
    this.workerIndex = workerParams.workerIndex;
    this.parallelIndex = workerParams.parallelIndex;
    this._projectInternal = projectInternal;
    this.project = projectInternal.project;
    this._configInternal = configInternal;
    this.config = configInternal.config;
    this.title = (_test$title = test === null || test === void 0 ? void 0 : test.title) !== null && _test$title !== void 0 ? _test$title : '';
    this.titlePath = (_test$titlePath = test === null || test === void 0 ? void 0 : test.titlePath()) !== null && _test$titlePath !== void 0 ? _test$titlePath : [];
    this.file = (_test$location$file = test === null || test === void 0 ? void 0 : test.location.file) !== null && _test$location$file !== void 0 ? _test$location$file : '';
    this.line = (_test$location$line = test === null || test === void 0 ? void 0 : test.location.line) !== null && _test$location$line !== void 0 ? _test$location$line : 0;
    this.column = (_test$location$column = test === null || test === void 0 ? void 0 : test.location.column) !== null && _test$location$column !== void 0 ? _test$location$column : 0;
    this.tags = (_test$tags = test === null || test === void 0 ? void 0 : test.tags) !== null && _test$tags !== void 0 ? _test$tags : [];
    this.fn = (_test$fn = test === null || test === void 0 ? void 0 : test.fn) !== null && _test$fn !== void 0 ? _test$fn : () => {};
    this.expectedStatus = (_test$expectedStatus = test === null || test === void 0 ? void 0 : test.expectedStatus) !== null && _test$expectedStatus !== void 0 ? _test$expectedStatus : 'skipped';
    this._timeoutManager = new _timeoutManager.TimeoutManager(this.project.timeout);
    if (configInternal.configCLIOverrides.debug) this._setDebugMode();
    this.outputDir = (() => {
      const relativeTestFilePath = _path.default.relative(this.project.testDir, this._requireFile.replace(/\.(spec|test)\.(js|ts|jsx|tsx|mjs|mts|cjs|cts)$/, ''));
      const sanitizedRelativePath = relativeTestFilePath.replace(process.platform === 'win32' ? new RegExp('\\\\', 'g') : new RegExp('/', 'g'), '-');
      const fullTitleWithoutSpec = this.titlePath.slice(1).join(' ');
      let testOutputDir = (0, _util.trimLongString)(sanitizedRelativePath + '-' + (0, _utils.sanitizeForFilePath)(fullTitleWithoutSpec), _util.windowsFilesystemFriendlyLength);
      if (projectInternal.id) testOutputDir += '-' + (0, _utils.sanitizeForFilePath)(projectInternal.id);
      if (this.retry) testOutputDir += '-retry' + this.retry;
      if (this.repeatEachIndex) testOutputDir += '-repeat' + this.repeatEachIndex;
      return _path.default.join(this.project.outputDir, testOutputDir);
    })();
    this.snapshotDir = (() => {
      const relativeTestFilePath = _path.default.relative(this.project.testDir, this._requireFile);
      return _path.default.join(this.project.snapshotDir, relativeTestFilePath + '-snapshots');
    })();
    this._attachmentsPush = this.attachments.push.bind(this.attachments);
    this.attachments.push = (...attachments) => {
      for (const a of attachments) {
        var _this$_parentStep;
        this._attach(a, (_this$_parentStep = this._parentStep()) === null || _this$_parentStep === void 0 ? void 0 : _this$_parentStep.stepId);
      }
      return this.attachments.length;
    };
    this._tracing = new _testTracing.TestTracing(this, workerParams.artifactsDir);
  }
  _modifier(type, modifierArgs) {
    if (typeof modifierArgs[1] === 'function') {
      throw new Error(['It looks like you are calling test.skip() inside the test and pass a callback.', 'Pass a condition instead and optional description instead:', `test('my test', async ({ page, isMobile }) => {`, `  test.skip(isMobile, 'This test is not applicable on mobile');`, `});`].join('\n'));
    }
    if (modifierArgs.length >= 1 && !modifierArgs[0]) return;
    const description = modifierArgs[1];
    this.annotations.push({
      type,
      description
    });
    if (type === 'slow') {
      this._timeoutManager.slow();
    } else if (type === 'skip' || type === 'fixme') {
      this.expectedStatus = 'skipped';
      throw new TestSkipError('Test is skipped: ' + (description || ''));
    } else if (type === 'fail') {
      if (this.expectedStatus !== 'skipped') this.expectedStatus = 'failed';
    }
  }
  _findLastPredefinedStep(steps) {
    // Find the deepest predefined step that has not finished yet.
    for (let i = steps.length - 1; i >= 0; i--) {
      const child = this._findLastPredefinedStep(steps[i].steps);
      if (child) return child;
      if ((steps[i].category === 'hook' || steps[i].category === 'fixture') && !steps[i].endWallTime) return steps[i];
    }
  }
  _parentStep() {
    var _currentZone$data;
    return (_currentZone$data = (0, _utils.currentZone)().data('stepZone')) !== null && _currentZone$data !== void 0 ? _currentZone$data : this._findLastPredefinedStep(this._steps);
  }
  _addStep(data, parentStep) {
    var _parentStep, _parentStep2;
    const stepId = `${data.category}@${++this._lastStepId}`;
    if (data.category === 'hook' || data.category === 'fixture') {
      // Predefined steps form a fixed hierarchy - use the current one as parent.
      parentStep = this._findLastPredefinedStep(this._steps);
    } else {
      if (!parentStep) parentStep = this._parentStep();
    }
    const filteredStack = (0, _util.filteredStackTrace)((0, _utils.captureRawStack)());
    data.boxedStack = (_parentStep = parentStep) === null || _parentStep === void 0 ? void 0 : _parentStep.boxedStack;
    if (!data.boxedStack && data.box) {
      data.boxedStack = filteredStack.slice(1);
      data.location = data.location || data.boxedStack[0];
    }
    data.location = data.location || filteredStack[0];
    const attachmentIndices = [];
    const step = {
      stepId,
      ...data,
      steps: [],
      attachmentIndices,
      info: new TestStepInfoImpl(this, stepId),
      complete: result => {
        if (step.endWallTime) return;
        step.endWallTime = Date.now();
        if (result.error) {
          var _result$error;
          if (typeof result.error === 'object' && !((_result$error = result.error) !== null && _result$error !== void 0 && _result$error[stepSymbol])) result.error[stepSymbol] = step;
          const error = (0, _util2.testInfoError)(result.error);
          if (data.boxedStack) error.stack = `${error.message}\n${(0, _utils.stringifyStackFrames)(data.boxedStack).join('\n')}`;
          step.error = error;
        }
        if (!step.error) {
          // Soft errors inside try/catch will make the test fail.
          // In order to locate the failing step, we are marking all the parent
          // steps as failing unconditionally.
          for (const childStep of step.steps) {
            if (childStep.error && childStep.infectParentStepsWithError) {
              step.error = childStep.error;
              step.infectParentStepsWithError = true;
              break;
            }
          }
        }
        const payload = {
          testId: this.testId,
          stepId,
          wallTime: step.endWallTime,
          error: step.error,
          suggestedRebaseline: result.suggestedRebaseline,
          annotations: step.info.annotations
        };
        this._onStepEnd(payload);
        const errorForTrace = step.error ? {
          name: '',
          message: step.error.message || '',
          stack: step.error.stack
        } : undefined;
        const attachments = attachmentIndices.map(i => this.attachments[i]);
        this._tracing.appendAfterActionForStep(stepId, errorForTrace, attachments, step.info.annotations);
      }
    };
    const parentStepList = parentStep ? parentStep.steps : this._steps;
    parentStepList.push(step);
    this._stepMap.set(stepId, step);
    const payload = {
      testId: this.testId,
      stepId,
      parentStepId: parentStep ? parentStep.stepId : undefined,
      title: data.title,
      category: data.category,
      wallTime: Date.now(),
      location: data.location
    };
    this._onStepBegin(payload);
    this._tracing.appendBeforeActionForStep(stepId, (_parentStep2 = parentStep) === null || _parentStep2 === void 0 ? void 0 : _parentStep2.stepId, data.category, data.apiName || data.title, data.params, data.location ? [data.location] : []);
    return step;
  }
  _interrupt() {
    // Mark as interrupted so we can ignore TimeoutError thrown by interrupt() call.
    this._wasInterrupted = true;
    this._timeoutManager.interrupt();
    // Do not overwrite existing failure (for example, unhandled rejection) with "interrupted".
    if (this.status === 'passed') this.status = 'interrupted';
  }
  _failWithError(error) {
    if (this.status === 'passed' || this.status === 'skipped') this.status = error instanceof _timeoutManager.TimeoutManagerError ? 'timedOut' : 'failed';
    const serialized = (0, _util2.testInfoError)(error);
    const step = typeof error === 'object' ? error === null || error === void 0 ? void 0 : error[stepSymbol] : undefined;
    if (step && step.boxedStack) serialized.stack = `${error.name}: ${error.message}\n${(0, _utils.stringifyStackFrames)(step.boxedStack).join('\n')}`;
    this.errors.push(serialized);
    this._tracing.appendForError(serialized);
  }
  async _runAsStep(stepInfo, cb) {
    const step = this._addStep(stepInfo);
    try {
      await cb();
      step.complete({});
    } catch (error) {
      step.complete({
        error
      });
      throw error;
    }
  }
  async _runWithTimeout(runnable, cb) {
    try {
      await this._timeoutManager.withRunnable(runnable, async () => {
        try {
          await cb();
        } catch (e) {
          if (this._allowSkips && e instanceof TestSkipError) {
            if (this.status === 'passed') this.status = 'skipped';
          } else {
            // Unfortunately, we have to handle user errors and timeout errors differently.
            // Consider the following scenario:
            // - locator.click times out
            // - all steps containing the test function finish with TimeoutManagerError
            // - test finishes, the page is closed and this triggers locator.click error
            // - we would like to present the locator.click error to the user
            // - therefore, we need a try/catch inside the "run with timeout" block and capture the error
            this._failWithError(e);
          }
          throw e;
        }
      });
    } catch (error) {
      // When interrupting, we arrive here with a TimeoutManagerError, but we should not
      // consider it a timeout.
      if (!this._wasInterrupted && error instanceof _timeoutManager.TimeoutManagerError) this._failWithError(error);
      throw error;
    }
  }
  _isFailure() {
    return this.status !== 'skipped' && this.status !== this.expectedStatus;
  }
  _currentHookType() {
    const type = this._timeoutManager.currentSlotType();
    return ['beforeAll', 'afterAll', 'beforeEach', 'afterEach'].includes(type) ? type : undefined;
  }
  _setDebugMode() {
    this._timeoutManager.setIgnoreTimeouts();
  }

  // ------------ TestInfo methods ------------

  async attach(name, options = {}) {
    const step = this._addStep({
      title: `attach "${name}"`,
      category: 'attach'
    });
    this._attach(await (0, _util.normalizeAndSaveAttachment)(this.outputPath(), name, options), step.stepId);
    step.complete({});
  }
  _attach(attachment, stepId) {
    var _attachment$body;
    const index = this._attachmentsPush(attachment) - 1;
    if (stepId) this._stepMap.get(stepId).attachmentIndices.push(index);else this._tracing.appendTopLevelAttachment(attachment);
    this._onAttach({
      testId: this.testId,
      name: attachment.name,
      contentType: attachment.contentType,
      path: attachment.path,
      body: (_attachment$body = attachment.body) === null || _attachment$body === void 0 ? void 0 : _attachment$body.toString('base64'),
      stepId
    });
  }
  outputPath(...pathSegments) {
    const outputPath = this._getOutputPath(...pathSegments);
    _fs.default.mkdirSync(this.outputDir, {
      recursive: true
    });
    return outputPath;
  }
  _getOutputPath(...pathSegments) {
    const joinedPath = _path.default.join(...pathSegments);
    const outputPath = (0, _util.getContainedPath)(this.outputDir, joinedPath);
    if (outputPath) return outputPath;
    throw new Error(`The outputPath is not allowed outside of the parent directory. Please fix the defined path.\n\n\toutputPath: ${joinedPath}`);
  }
  _fsSanitizedTestName() {
    const fullTitleWithoutSpec = this.titlePath.slice(1).join(' ');
    return (0, _utils.sanitizeForFilePath)((0, _util.trimLongString)(fullTitleWithoutSpec));
  }
  _resolveSnapshotPath(template, defaultTemplate, pathSegments, extension) {
    const subPath = _path.default.join(...pathSegments);
    const dir = _path.default.dirname(subPath);
    const ext = extension !== null && extension !== void 0 ? extension : _path.default.extname(subPath);
    const name = _path.default.basename(subPath, ext);
    const relativeTestFilePath = _path.default.relative(this.project.testDir, this._requireFile);
    const parsedRelativeTestFilePath = _path.default.parse(relativeTestFilePath);
    const projectNamePathSegment = (0, _utils.sanitizeForFilePath)(this.project.name);
    const actualTemplate = template || this._projectInternal.snapshotPathTemplate || defaultTemplate;
    const snapshotPath = actualTemplate.replace(/\{(.)?testDir\}/g, '$1' + this.project.testDir).replace(/\{(.)?snapshotDir\}/g, '$1' + this.project.snapshotDir).replace(/\{(.)?snapshotSuffix\}/g, this.snapshotSuffix ? '$1' + this.snapshotSuffix : '').replace(/\{(.)?testFileDir\}/g, '$1' + parsedRelativeTestFilePath.dir).replace(/\{(.)?platform\}/g, '$1' + process.platform).replace(/\{(.)?projectName\}/g, projectNamePathSegment ? '$1' + projectNamePathSegment : '').replace(/\{(.)?testName\}/g, '$1' + this._fsSanitizedTestName()).replace(/\{(.)?testFileName\}/g, '$1' + parsedRelativeTestFilePath.base).replace(/\{(.)?testFilePath\}/g, '$1' + relativeTestFilePath).replace(/\{(.)?arg\}/g, '$1' + _path.default.join(dir, name)).replace(/\{(.)?ext\}/g, ext ? '$1' + ext : '');
    return _path.default.normalize(_path.default.resolve(this._configInternal.configDir, snapshotPath));
  }
  snapshotPath(...pathSegments) {
    const legacyTemplate = '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{-snapshotSuffix}{ext}';
    return this._resolveSnapshotPath(undefined, legacyTemplate, pathSegments);
  }
  skip(...args) {
    this._modifier('skip', args);
  }
  fixme(...args) {
    this._modifier('fixme', args);
  }
  fail(...args) {
    this._modifier('fail', args);
  }
  slow(...args) {
    this._modifier('slow', args);
  }
  setTimeout(timeout) {
    this._timeoutManager.setTimeout(timeout);
  }
}
exports.TestInfoImpl = TestInfoImpl;
class TestStepInfoImpl {
  constructor(testInfo, stepId) {
    this.annotations = [];
    this._testInfo = void 0;
    this._stepId = void 0;
    this._testInfo = testInfo;
    this._stepId = stepId;
  }
  async _runStepBody(skip, body) {
    if (skip) {
      this.annotations.push({
        type: 'skip'
      });
      return undefined;
    }
    try {
      return await body(this);
    } catch (e) {
      if (e instanceof StepSkipError) return undefined;
      throw e;
    }
  }
  _attachToStep(attachment) {
    this._testInfo._attach(attachment, this._stepId);
  }
  async attach(name, options) {
    this._attachToStep(await (0, _util.normalizeAndSaveAttachment)(this._testInfo.outputPath(), name, options));
  }
  skip(...args) {
    // skip();
    // skip(condition: boolean, description: string);
    if (args.length > 0 && !args[0]) return;
    const description = args[1];
    this.annotations.push({
      type: 'skip',
      description
    });
    throw new StepSkipError(description);
  }
}
exports.TestStepInfoImpl = TestStepInfoImpl;
class TestSkipError extends Error {}
exports.TestSkipError = TestSkipError;
class StepSkipError extends Error {}
exports.StepSkipError = StepSkipError;
const stepSymbol = Symbol('step');