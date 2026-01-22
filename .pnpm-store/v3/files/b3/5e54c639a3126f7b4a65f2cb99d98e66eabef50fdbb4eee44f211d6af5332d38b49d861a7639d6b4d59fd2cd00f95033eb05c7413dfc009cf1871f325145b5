"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.webColors = exports.noColors = void 0;
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

const webColors = exports.webColors = {
  enabled: true,
  reset: text => applyStyle(0, 0, text),
  bold: text => applyStyle(1, 22, text),
  dim: text => applyStyle(2, 22, text),
  italic: text => applyStyle(3, 23, text),
  underline: text => applyStyle(4, 24, text),
  inverse: text => applyStyle(7, 27, text),
  hidden: text => applyStyle(8, 28, text),
  strikethrough: text => applyStyle(9, 29, text),
  black: text => applyStyle(30, 39, text),
  red: text => applyStyle(31, 39, text),
  green: text => applyStyle(32, 39, text),
  yellow: text => applyStyle(33, 39, text),
  blue: text => applyStyle(34, 39, text),
  magenta: text => applyStyle(35, 39, text),
  cyan: text => applyStyle(36, 39, text),
  white: text => applyStyle(37, 39, text),
  gray: text => applyStyle(90, 39, text),
  grey: text => applyStyle(90, 39, text)
};
const noColors = exports.noColors = {
  enabled: false,
  reset: t => t,
  bold: t => t,
  dim: t => t,
  italic: t => t,
  underline: t => t,
  inverse: t => t,
  hidden: t => t,
  strikethrough: t => t,
  black: t => t,
  red: t => t,
  green: t => t,
  yellow: t => t,
  blue: t => t,
  magenta: t => t,
  cyan: t => t,
  white: t => t,
  gray: t => t,
  grey: t => t
};
const applyStyle = (open, close, text) => `\u001b[${open}m${text}\u001b[${close}m`;