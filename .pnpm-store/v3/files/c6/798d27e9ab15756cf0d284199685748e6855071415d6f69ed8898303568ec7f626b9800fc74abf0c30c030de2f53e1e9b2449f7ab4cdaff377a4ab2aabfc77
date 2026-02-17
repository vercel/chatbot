"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Watcher = void 0;
var _utilsBundle = require("./utilsBundle");
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

class Watcher {
  constructor(onChange) {
    this._onChange = void 0;
    this._watchedPaths = [];
    this._ignoredFolders = [];
    this._collector = [];
    this._fsWatcher = void 0;
    this._throttleTimer = void 0;
    this._onChange = onChange;
  }
  async update(watchedPaths, ignoredFolders, reportPending) {
    var _this$_fsWatcher;
    if (JSON.stringify([this._watchedPaths, this._ignoredFolders]) === JSON.stringify(watchedPaths, ignoredFolders)) return;
    if (reportPending) this._reportEventsIfAny();
    this._watchedPaths = watchedPaths;
    this._ignoredFolders = ignoredFolders;
    void ((_this$_fsWatcher = this._fsWatcher) === null || _this$_fsWatcher === void 0 ? void 0 : _this$_fsWatcher.close());
    this._fsWatcher = undefined;
    this._collector.length = 0;
    clearTimeout(this._throttleTimer);
    this._throttleTimer = undefined;
    if (!this._watchedPaths.length) return;
    const ignored = [...this._ignoredFolders, '**/node_modules/**'];
    this._fsWatcher = _utilsBundle.chokidar.watch(watchedPaths, {
      ignoreInitial: true,
      ignored
    }).on('all', async (event, file) => {
      if (this._throttleTimer) clearTimeout(this._throttleTimer);
      this._collector.push({
        event,
        file
      });
      this._throttleTimer = setTimeout(() => this._reportEventsIfAny(), 250);
    });
    await new Promise((resolve, reject) => this._fsWatcher.once('ready', resolve).once('error', reject));
  }
  async close() {
    var _this$_fsWatcher2;
    await ((_this$_fsWatcher2 = this._fsWatcher) === null || _this$_fsWatcher2 === void 0 ? void 0 : _this$_fsWatcher2.close());
  }
  _reportEventsIfAny() {
    if (this._collector.length) this._onChange(this._collector.slice());
    this._collector.length = 0;
  }
}
exports.Watcher = Watcher;