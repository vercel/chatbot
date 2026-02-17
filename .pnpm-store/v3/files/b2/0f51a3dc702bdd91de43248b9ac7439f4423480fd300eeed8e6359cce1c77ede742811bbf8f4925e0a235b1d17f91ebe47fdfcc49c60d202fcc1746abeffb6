"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.languageSet = languageSet;
var _csharp = require("./csharp");
var _java = require("./java");
var _javascript = require("./javascript");
var _jsonl = require("./jsonl");
var _python = require("./python");
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

function languageSet() {
  return new Set([new _java.JavaLanguageGenerator('junit'), new _java.JavaLanguageGenerator('library'), new _javascript.JavaScriptLanguageGenerator(/* isPlaywrightTest */false), new _javascript.JavaScriptLanguageGenerator(/* isPlaywrightTest */true), new _python.PythonLanguageGenerator(/* isAsync */false, /* isPytest */true), new _python.PythonLanguageGenerator(/* isAsync */false, /* isPytest */false), new _python.PythonLanguageGenerator(/* isAsync */true, /* isPytest */false), new _csharp.CSharpLanguageGenerator('mstest'), new _csharp.CSharpLanguageGenerator('nunit'), new _csharp.CSharpLanguageGenerator('library'), new _jsonl.JsonlLanguageGenerator()]);
}