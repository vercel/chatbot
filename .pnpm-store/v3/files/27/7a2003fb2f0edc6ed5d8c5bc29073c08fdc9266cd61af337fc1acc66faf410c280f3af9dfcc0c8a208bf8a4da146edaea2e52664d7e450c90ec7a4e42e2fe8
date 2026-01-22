"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ConsoleMessage = void 0;
var _jsHandle = require("./jsHandle");
var _page = require("./page");
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

class ConsoleMessage {
  constructor(platform, event) {
    this._page = void 0;
    this._event = void 0;
    this._page = 'page' in event && event.page ? _page.Page.from(event.page) : null;
    this._event = event;
    if (platform.inspectCustom) this[platform.inspectCustom] = () => this._inspect();
  }
  page() {
    return this._page;
  }
  type() {
    return this._event.type;
  }
  text() {
    return this._event.text;
  }
  args() {
    return this._event.args.map(_jsHandle.JSHandle.from);
  }
  location() {
    return this._event.location;
  }
  _inspect() {
    return this.text();
  }
}
exports.ConsoleMessage = ConsoleMessage;