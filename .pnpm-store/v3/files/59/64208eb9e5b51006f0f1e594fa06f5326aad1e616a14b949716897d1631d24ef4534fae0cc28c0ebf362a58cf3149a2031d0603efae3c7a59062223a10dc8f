"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.fromKeyboardModifiers = fromKeyboardModifiers;
exports.generateCode = generateCode;
exports.sanitizeDeviceOptions = sanitizeDeviceOptions;
exports.toClickOptionsForSourceCode = toClickOptionsForSourceCode;
exports.toKeyboardModifiers = toKeyboardModifiers;
exports.toSignalMap = toSignalMap;
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

function generateCode(actions, languageGenerator, options) {
  const header = languageGenerator.generateHeader(options);
  const footer = languageGenerator.generateFooter(options.saveStorage);
  const actionTexts = actions.map(a => languageGenerator.generateAction(a)).filter(Boolean);
  const text = [header, ...actionTexts, footer].join('\n');
  return {
    header,
    footer,
    actionTexts,
    text
  };
}
function sanitizeDeviceOptions(device, options) {
  // Filter out all the properties from the device descriptor.
  const cleanedOptions = {};
  for (const property in options) {
    if (JSON.stringify(device[property]) !== JSON.stringify(options[property])) cleanedOptions[property] = options[property];
  }
  return cleanedOptions;
}
function toSignalMap(action) {
  let popup;
  let download;
  let dialog;
  for (const signal of action.signals) {
    if (signal.name === 'popup') popup = signal;else if (signal.name === 'download') download = signal;else if (signal.name === 'dialog') dialog = signal;
  }
  return {
    popup,
    download,
    dialog
  };
}
function toKeyboardModifiers(modifiers) {
  const result = [];
  if (modifiers & 1) result.push('Alt');
  if (modifiers & 2) result.push('ControlOrMeta');
  if (modifiers & 4) result.push('ControlOrMeta');
  if (modifiers & 8) result.push('Shift');
  return result;
}
function fromKeyboardModifiers(modifiers) {
  let result = 0;
  if (!modifiers) return result;
  if (modifiers.includes('Alt')) result |= 1;
  if (modifiers.includes('Control')) result |= 2;
  if (modifiers.includes('ControlOrMeta')) result |= 2;
  if (modifiers.includes('Meta')) result |= 4;
  if (modifiers.includes('Shift')) result |= 8;
  return result;
}
function toClickOptionsForSourceCode(action) {
  const modifiers = toKeyboardModifiers(action.modifiers);
  const options = {};
  if (action.button !== 'left') options.button = action.button;
  if (modifiers.length) options.modifiers = modifiers;
  // Do not render clickCount === 2 for dblclick.
  if (action.clickCount > 2) options.clickCount = action.clickCount;
  if (action.position) options.position = action.position;
  return options;
}