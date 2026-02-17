"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.fileUploadSizeLimit = void 0;
exports.mkdirIfNeeded = mkdirIfNeeded;
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

// Keep in sync with the server.
const fileUploadSizeLimit = exports.fileUploadSizeLimit = 50 * 1024 * 1024;
async function mkdirIfNeeded(platform, filePath) {
  // This will harmlessly throw on windows if the dirname is the root directory.
  await platform.fs().promises.mkdir(platform.path().dirname(filePath), {
    recursive: true
  }).catch(() => {});
}