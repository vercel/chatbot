"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.testInfoError = testInfoError;
var _matcherHint = require("../matchers/matcherHint");
var _util = require("../util");
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

function testInfoError(error) {
  const result = (0, _util.serializeError)(error);
  if (error instanceof _matcherHint.ExpectError) result.matcherResult = error.matcherResult;
  return result;
}