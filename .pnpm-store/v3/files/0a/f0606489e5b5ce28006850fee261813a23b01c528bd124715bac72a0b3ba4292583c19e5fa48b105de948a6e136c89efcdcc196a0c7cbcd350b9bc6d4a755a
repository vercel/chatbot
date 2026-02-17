"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ContextRecorder = void 0;
exports.generateFrameSelector = generateFrameSelector;
var _events = require("events");
var _recorderCollection = require("./recorderCollection");
var recorderSource = _interopRequireWildcard(require("../../generated/pollingRecorderSource"));
var _utils = require("../../utils");
var _timeoutRunner = require("../../utils/isomorphic/timeoutRunner");
var _browserContext = require("../browserContext");
var _languages = require("../codegen/languages");
var _frames = require("../frames");
var _page = require("../page");
var _throttledFile = require("./throttledFile");
var _language = require("../codegen/language");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
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

class ContextRecorder extends _events.EventEmitter {
  constructor(context, params, delegate) {
    super();
    this._collection = void 0;
    this._pageAliases = new Map();
    this._lastPopupOrdinal = 0;
    this._lastDialogOrdinal = -1;
    this._lastDownloadOrdinal = -1;
    this._context = void 0;
    this._params = void 0;
    this._delegate = void 0;
    this._recorderSources = void 0;
    this._throttledOutputFile = null;
    this._orderedLanguages = [];
    this._listeners = [];
    this._context = context;
    this._params = params;
    this._delegate = delegate;
    this._recorderSources = [];
    const language = params.language || context.attribution.playwright.options.sdkLanguage;
    this.setOutput(language, params.outputFile);

    // Make a copy of options to modify them later.
    const languageGeneratorOptions = {
      browserName: context._browser.options.name,
      launchOptions: {
        headless: false,
        ...params.launchOptions,
        tracesDir: undefined
      },
      contextOptions: {
        ...params.contextOptions
      },
      deviceName: params.device,
      saveStorage: params.saveStorage
    };
    this._collection = new _recorderCollection.RecorderCollection(this._pageAliases);
    this._collection.on('change', actions => {
      this._recorderSources = [];
      for (const languageGenerator of this._orderedLanguages) {
        var _this$_throttledOutpu;
        const {
          header,
          footer,
          actionTexts,
          text
        } = (0, _language.generateCode)(actions, languageGenerator, languageGeneratorOptions);
        const source = {
          isRecorded: true,
          label: languageGenerator.name,
          group: languageGenerator.groupName,
          id: languageGenerator.id,
          text,
          header,
          footer,
          actions: actionTexts,
          language: languageGenerator.highlighter,
          highlight: []
        };
        source.revealLine = text.split('\n').length - 1;
        this._recorderSources.push(source);
        if (languageGenerator === this._orderedLanguages[0]) (_this$_throttledOutpu = this._throttledOutputFile) === null || _this$_throttledOutpu === void 0 || _this$_throttledOutpu.setContent(source.text);
      }
      this.emit(ContextRecorder.Events.Change, {
        sources: this._recorderSources,
        actions
      });
    });
    context.on(_browserContext.BrowserContext.Events.BeforeClose, () => {
      var _this$_throttledOutpu2;
      (_this$_throttledOutpu2 = this._throttledOutputFile) === null || _this$_throttledOutpu2 === void 0 || _this$_throttledOutpu2.flush();
    });
    this._listeners.push(_utils.eventsHelper.addEventListener(process, 'exit', () => {
      var _this$_throttledOutpu3;
      (_this$_throttledOutpu3 = this._throttledOutputFile) === null || _this$_throttledOutpu3 === void 0 || _this$_throttledOutpu3.flush();
    }));
    this.setEnabled(params.mode === 'recording');
  }
  setOutput(codegenId, outputFile) {
    var _this$_collection;
    const languages = (0, _languages.languageSet)();
    const primaryLanguage = [...languages].find(l => l.id === codegenId);
    if (!primaryLanguage) throw new Error(`\n===============================\nUnsupported language: '${codegenId}'\n===============================\n`);
    languages.delete(primaryLanguage);
    this._orderedLanguages = [primaryLanguage, ...languages];
    this._throttledOutputFile = outputFile ? new _throttledFile.ThrottledFile(outputFile) : null;
    (_this$_collection = this._collection) === null || _this$_collection === void 0 || _this$_collection.restart();
  }
  languageName(id) {
    for (const lang of this._orderedLanguages) {
      if (!id || lang.id === id) return lang.highlighter;
    }
    return 'javascript';
  }
  async install() {
    this._context.on(_browserContext.BrowserContext.Events.Page, page => this._onPage(page));
    for (const page of this._context.pages()) this._onPage(page);
    this._context.on(_browserContext.BrowserContext.Events.Dialog, dialog => this._onDialog(dialog.page()));

    // Input actions that potentially lead to navigation are intercepted on the page and are
    // performed by the Playwright.
    await this._context.exposeBinding('__pw_recorderPerformAction', false, (source, action) => this._performAction(source.frame, action));

    // Other non-essential actions are simply being recorded.
    await this._context.exposeBinding('__pw_recorderRecordAction', false, (source, action) => this._recordAction(source.frame, action));
    await this._context.extendInjectedScript(recorderSource.source);
  }
  setEnabled(enabled) {
    this._collection.setEnabled(enabled);
  }
  dispose() {
    _utils.eventsHelper.removeEventListeners(this._listeners);
  }
  async _onPage(page) {
    // First page is called page, others are called popup1, popup2, etc.
    const frame = page.mainFrame();
    page.on('close', () => {
      this._collection.addRecordedAction({
        frame: this._describeMainFrame(page),
        action: {
          name: 'closePage',
          signals: []
        },
        startTime: (0, _utils.monotonicTime)()
      });
      this._pageAliases.delete(page);
    });
    frame.on(_frames.Frame.Events.InternalNavigation, event => {
      if (event.isPublic) this._onFrameNavigated(frame, page);
    });
    page.on(_page.Page.Events.Download, () => this._onDownload(page));
    const suffix = this._pageAliases.size ? String(++this._lastPopupOrdinal) : '';
    const pageAlias = 'page' + suffix;
    this._pageAliases.set(page, pageAlias);
    if (page.opener()) {
      this._onPopup(page.opener(), page);
    } else {
      this._collection.addRecordedAction({
        frame: this._describeMainFrame(page),
        action: {
          name: 'openPage',
          url: page.mainFrame().url(),
          signals: []
        },
        startTime: (0, _utils.monotonicTime)()
      });
    }
  }
  clearScript() {
    this._collection.restart();
    if (this._params.mode === 'recording') {
      for (const page of this._context.pages()) this._onFrameNavigated(page.mainFrame(), page);
    }
  }
  runTask(task) {
    // TODO: implement
  }
  _describeMainFrame(page) {
    return {
      pageAlias: this._pageAliases.get(page),
      framePath: []
    };
  }
  async _describeFrame(frame) {
    return {
      pageAlias: this._pageAliases.get(frame._page),
      framePath: await generateFrameSelector(frame)
    };
  }
  testIdAttributeName() {
    return this._params.testIdAttributeName || this._context.selectors().testIdAttributeName() || 'data-testid';
  }
  async _createActionInContext(frame, action) {
    var _this$_delegate$rewri, _this$_delegate;
    const frameDescription = await this._describeFrame(frame);
    const actionInContext = {
      frame: frameDescription,
      action,
      description: undefined,
      startTime: (0, _utils.monotonicTime)()
    };
    await ((_this$_delegate$rewri = (_this$_delegate = this._delegate).rewriteActionInContext) === null || _this$_delegate$rewri === void 0 ? void 0 : _this$_delegate$rewri.call(_this$_delegate, this._pageAliases, actionInContext));
    return actionInContext;
  }
  async _performAction(frame, action) {
    await this._collection.performAction(await this._createActionInContext(frame, action));
  }
  async _recordAction(frame, action) {
    this._collection.addRecordedAction(await this._createActionInContext(frame, action));
  }
  _onFrameNavigated(frame, page) {
    const pageAlias = this._pageAliases.get(page);
    this._collection.signal(pageAlias, frame, {
      name: 'navigation',
      url: frame.url()
    });
  }
  _onPopup(page, popup) {
    const pageAlias = this._pageAliases.get(page);
    const popupAlias = this._pageAliases.get(popup);
    this._collection.signal(pageAlias, page.mainFrame(), {
      name: 'popup',
      popupAlias
    });
  }
  _onDownload(page) {
    const pageAlias = this._pageAliases.get(page);
    ++this._lastDownloadOrdinal;
    this._collection.signal(pageAlias, page.mainFrame(), {
      name: 'download',
      downloadAlias: this._lastDownloadOrdinal ? String(this._lastDownloadOrdinal) : ''
    });
  }
  _onDialog(page) {
    const pageAlias = this._pageAliases.get(page);
    ++this._lastDialogOrdinal;
    this._collection.signal(pageAlias, page.mainFrame(), {
      name: 'dialog',
      dialogAlias: this._lastDialogOrdinal ? String(this._lastDialogOrdinal) : ''
    });
  }
}
exports.ContextRecorder = ContextRecorder;
ContextRecorder.Events = {
  Change: 'change'
};
async function generateFrameSelector(frame) {
  const selectorPromises = [];
  while (frame) {
    const parent = frame.parentFrame();
    if (!parent) break;
    selectorPromises.push(generateFrameSelectorInParent(parent, frame));
    frame = parent;
  }
  const result = await Promise.all(selectorPromises);
  return result.reverse();
}
async function generateFrameSelectorInParent(parent, frame) {
  const result = await (0, _timeoutRunner.raceAgainstDeadline)(async () => {
    try {
      const frameElement = await frame.frameElement();
      if (!frameElement || !parent) return;
      const utility = await parent._utilityContext();
      const injected = await utility.injectedScript();
      const selector = await injected.evaluate((injected, element) => {
        return injected.generateSelectorSimple(element);
      }, frameElement);
      return selector;
    } catch (e) {}
  }, (0, _utils.monotonicTime)() + 2000);
  if (!result.timedOut && result.result) return result.result;
  if (frame.name()) return `iframe[name=${(0, _utils.quoteCSSAttributeValue)(frame.name())}]`;
  return `iframe[src=${(0, _utils.quoteCSSAttributeValue)(frame.url())}]`;
}