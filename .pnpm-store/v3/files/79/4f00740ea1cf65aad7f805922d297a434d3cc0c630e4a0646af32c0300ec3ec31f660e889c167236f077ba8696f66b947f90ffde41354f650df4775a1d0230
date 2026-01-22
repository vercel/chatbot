"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ElementHandle = void 0;
exports.convertInputFiles = convertInputFiles;
exports.convertSelectOptionValues = convertSelectOptionValues;
exports.determineScreenshotType = determineScreenshotType;
var _frame = require("./frame");
var _jsHandle = require("./jsHandle");
var _assert = require("../utils/isomorphic/assert");
var _fileUtils = require("./fileUtils");
var _rtti = require("../utils/isomorphic/rtti");
var _writableStream = require("./writableStream");
var _mimeType = require("../utils/isomorphic/mimeType");
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

class ElementHandle extends _jsHandle.JSHandle {
  static from(handle) {
    return handle._object;
  }
  static fromNullable(handle) {
    return handle ? ElementHandle.from(handle) : null;
  }
  constructor(parent, type, guid, initializer) {
    super(parent, type, guid, initializer);
    this._elementChannel = void 0;
    this._elementChannel = this._channel;
  }
  asElement() {
    return this;
  }
  async ownerFrame() {
    return _frame.Frame.fromNullable((await this._elementChannel.ownerFrame()).frame);
  }
  async contentFrame() {
    return _frame.Frame.fromNullable((await this._elementChannel.contentFrame()).frame);
  }
  async _generateLocatorString() {
    const value = (await this._elementChannel.generateLocatorString()).value;
    return value === undefined ? null : value;
  }
  async getAttribute(name) {
    const value = (await this._elementChannel.getAttribute({
      name
    })).value;
    return value === undefined ? null : value;
  }
  async inputValue() {
    return (await this._elementChannel.inputValue()).value;
  }
  async textContent() {
    const value = (await this._elementChannel.textContent()).value;
    return value === undefined ? null : value;
  }
  async innerText() {
    return (await this._elementChannel.innerText()).value;
  }
  async innerHTML() {
    return (await this._elementChannel.innerHTML()).value;
  }
  async isChecked() {
    return (await this._elementChannel.isChecked()).value;
  }
  async isDisabled() {
    return (await this._elementChannel.isDisabled()).value;
  }
  async isEditable() {
    return (await this._elementChannel.isEditable()).value;
  }
  async isEnabled() {
    return (await this._elementChannel.isEnabled()).value;
  }
  async isHidden() {
    return (await this._elementChannel.isHidden()).value;
  }
  async isVisible() {
    return (await this._elementChannel.isVisible()).value;
  }
  async dispatchEvent(type, eventInit = {}) {
    await this._elementChannel.dispatchEvent({
      type,
      eventInit: (0, _jsHandle.serializeArgument)(eventInit)
    });
  }
  async scrollIntoViewIfNeeded(options = {}) {
    await this._elementChannel.scrollIntoViewIfNeeded(options);
  }
  async hover(options = {}) {
    await this._elementChannel.hover(options);
  }
  async click(options = {}) {
    return await this._elementChannel.click(options);
  }
  async dblclick(options = {}) {
    return await this._elementChannel.dblclick(options);
  }
  async tap(options = {}) {
    return await this._elementChannel.tap(options);
  }
  async selectOption(values, options = {}) {
    const result = await this._elementChannel.selectOption({
      ...convertSelectOptionValues(values),
      ...options
    });
    return result.values;
  }
  async fill(value, options = {}) {
    return await this._elementChannel.fill({
      value,
      ...options
    });
  }
  async selectText(options = {}) {
    await this._elementChannel.selectText(options);
  }
  async setInputFiles(files, options = {}) {
    const frame = await this.ownerFrame();
    if (!frame) throw new Error('Cannot set input files to detached element');
    const converted = await convertInputFiles(this._platform, files, frame.page().context());
    await this._elementChannel.setInputFiles({
      ...converted,
      ...options
    });
  }
  async focus() {
    await this._elementChannel.focus();
  }
  async type(text, options = {}) {
    await this._elementChannel.type({
      text,
      ...options
    });
  }
  async press(key, options = {}) {
    await this._elementChannel.press({
      key,
      ...options
    });
  }
  async check(options = {}) {
    return await this._elementChannel.check(options);
  }
  async uncheck(options = {}) {
    return await this._elementChannel.uncheck(options);
  }
  async setChecked(checked, options) {
    if (checked) await this.check(options);else await this.uncheck(options);
  }
  async boundingBox() {
    const value = (await this._elementChannel.boundingBox()).value;
    return value === undefined ? null : value;
  }
  async screenshot(options = {}) {
    const mask = options.mask;
    const copy = {
      ...options,
      mask: undefined
    };
    if (!copy.type) copy.type = determineScreenshotType(options);
    if (mask) {
      copy.mask = mask.map(locator => ({
        frame: locator._frame._channel,
        selector: locator._selector
      }));
    }
    const result = await this._elementChannel.screenshot(copy);
    if (options.path) {
      await (0, _fileUtils.mkdirIfNeeded)(this._platform, options.path);
      await this._platform.fs().promises.writeFile(options.path, result.binary);
    }
    return result.binary;
  }
  async $(selector) {
    return ElementHandle.fromNullable((await this._elementChannel.querySelector({
      selector
    })).element);
  }
  async $$(selector) {
    const result = await this._elementChannel.querySelectorAll({
      selector
    });
    return result.elements.map(h => ElementHandle.from(h));
  }
  async $eval(selector, pageFunction, arg) {
    const result = await this._elementChannel.evalOnSelector({
      selector,
      expression: String(pageFunction),
      isFunction: typeof pageFunction === 'function',
      arg: (0, _jsHandle.serializeArgument)(arg)
    });
    return (0, _jsHandle.parseResult)(result.value);
  }
  async $$eval(selector, pageFunction, arg) {
    const result = await this._elementChannel.evalOnSelectorAll({
      selector,
      expression: String(pageFunction),
      isFunction: typeof pageFunction === 'function',
      arg: (0, _jsHandle.serializeArgument)(arg)
    });
    return (0, _jsHandle.parseResult)(result.value);
  }
  async waitForElementState(state, options = {}) {
    return await this._elementChannel.waitForElementState({
      state,
      ...options
    });
  }
  async waitForSelector(selector, options = {}) {
    const result = await this._elementChannel.waitForSelector({
      selector,
      ...options
    });
    return ElementHandle.fromNullable(result.element);
  }
}
exports.ElementHandle = ElementHandle;
function convertSelectOptionValues(values) {
  if (values === null) return {};
  if (!Array.isArray(values)) values = [values];
  if (!values.length) return {};
  for (let i = 0; i < values.length; i++) (0, _assert.assert)(values[i] !== null, `options[${i}]: expected object, got null`);
  if (values[0] instanceof ElementHandle) return {
    elements: values.map(v => v._elementChannel)
  };
  if ((0, _rtti.isString)(values[0])) return {
    options: values.map(valueOrLabel => ({
      valueOrLabel
    }))
  };
  return {
    options: values
  };
}
function filePayloadExceedsSizeLimit(payloads) {
  return payloads.reduce((size, item) => size + (item.buffer ? item.buffer.byteLength : 0), 0) >= _fileUtils.fileUploadSizeLimit;
}
async function resolvePathsAndDirectoryForInputFiles(platform, items) {
  var _localPaths;
  let localPaths;
  let localDirectory;
  for (const item of items) {
    const stat = await platform.fs().promises.stat(item);
    if (stat.isDirectory()) {
      if (localDirectory) throw new Error('Multiple directories are not supported');
      localDirectory = platform.path().resolve(item);
    } else {
      localPaths !== null && localPaths !== void 0 ? localPaths : localPaths = [];
      localPaths.push(platform.path().resolve(item));
    }
  }
  if ((_localPaths = localPaths) !== null && _localPaths !== void 0 && _localPaths.length && localDirectory) throw new Error('File paths must be all files or a single directory');
  return [localPaths, localDirectory];
}
async function convertInputFiles(platform, files, context) {
  const items = Array.isArray(files) ? files.slice() : [files];
  if (items.some(item => typeof item === 'string')) {
    if (!items.every(item => typeof item === 'string')) throw new Error('File paths cannot be mixed with buffers');
    const [localPaths, localDirectory] = await resolvePathsAndDirectoryForInputFiles(platform, items);
    if (context._connection.isRemote()) {
      const files = localDirectory ? (await platform.fs().promises.readdir(localDirectory, {
        withFileTypes: true,
        recursive: true
      })).filter(f => f.isFile()).map(f => platform.path().join(f.path, f.name)) : localPaths;
      const {
        writableStreams,
        rootDir
      } = await context._wrapApiCall(async () => context._channel.createTempFiles({
        rootDirName: localDirectory ? platform.path().basename(localDirectory) : undefined,
        items: await Promise.all(files.map(async file => {
          const lastModifiedMs = (await platform.fs().promises.stat(file)).mtimeMs;
          return {
            name: localDirectory ? platform.path().relative(localDirectory, file) : platform.path().basename(file),
            lastModifiedMs
          };
        }))
      }), true);
      for (let i = 0; i < files.length; i++) {
        const writable = _writableStream.WritableStream.from(writableStreams[i]);
        await platform.streamFile(files[i], writable.stream());
      }
      return {
        directoryStream: rootDir,
        streams: localDirectory ? undefined : writableStreams
      };
    }
    return {
      localPaths,
      localDirectory
    };
  }
  const payloads = items;
  if (filePayloadExceedsSizeLimit(payloads)) throw new Error('Cannot set buffer larger than 50Mb, please write it to a file and pass its path instead.');
  return {
    payloads
  };
}
function determineScreenshotType(options) {
  if (options.path) {
    const mimeType = (0, _mimeType.getMimeTypeForPath)(options.path);
    if (mimeType === 'image/png') return 'png';else if (mimeType === 'image/jpeg') return 'jpeg';
    throw new Error(`path: unsupported mime type "${mimeType}"`);
  }
  return options.type;
}