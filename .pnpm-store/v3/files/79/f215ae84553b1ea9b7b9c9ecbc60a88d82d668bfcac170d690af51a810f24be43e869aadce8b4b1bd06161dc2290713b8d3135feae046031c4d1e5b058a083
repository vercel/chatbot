"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.HarBackend = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _crypto = require("./utils/crypto");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

const redirectStatus = [301, 302, 303, 307, 308];
class HarBackend {
  constructor(harFile, baseDir, zipFile) {
    this.id = void 0;
    this._harFile = void 0;
    this._zipFile = void 0;
    this._baseDir = void 0;
    this.id = (0, _crypto.createGuid)();
    this._harFile = harFile;
    this._baseDir = baseDir;
    this._zipFile = zipFile;
  }
  async lookup(url, method, headers, postData, isNavigationRequest) {
    let entry;
    try {
      entry = await this._harFindResponse(url, method, headers, postData);
    } catch (e) {
      return {
        action: 'error',
        message: 'HAR error: ' + e.message
      };
    }
    if (!entry) return {
      action: 'noentry'
    };

    // If navigation is being redirected, restart it with the final url to ensure the document's url changes.
    if (entry.request.url !== url && isNavigationRequest) return {
      action: 'redirect',
      redirectURL: entry.request.url
    };
    const response = entry.response;
    try {
      const buffer = await this._loadContent(response.content);
      return {
        action: 'fulfill',
        status: response.status,
        headers: response.headers,
        body: buffer
      };
    } catch (e) {
      return {
        action: 'error',
        message: e.message
      };
    }
  }
  async _loadContent(content) {
    const file = content._file;
    let buffer;
    if (file) {
      if (this._zipFile) buffer = await this._zipFile.read(file);else buffer = await _fs.default.promises.readFile(_path.default.resolve(this._baseDir, file));
    } else {
      buffer = Buffer.from(content.text || '', content.encoding === 'base64' ? 'base64' : 'utf-8');
    }
    return buffer;
  }
  async _harFindResponse(url, method, headers, postData) {
    const harLog = this._harFile.log;
    const visited = new Set();
    while (true) {
      const entries = [];
      for (const candidate of harLog.entries) {
        if (candidate.request.url !== url || candidate.request.method !== method) continue;
        if (method === 'POST' && postData && candidate.request.postData) {
          const buffer = await this._loadContent(candidate.request.postData);
          if (!buffer.equals(postData)) {
            const boundary = multipartBoundary(headers);
            if (!boundary) continue;
            const candidataBoundary = multipartBoundary(candidate.request.headers);
            if (!candidataBoundary) continue;
            // Try to match multipart/form-data ignroing boundary as it changes between requests.
            if (postData.toString().replaceAll(boundary, '') !== buffer.toString().replaceAll(candidataBoundary, '')) continue;
          }
        }
        entries.push(candidate);
      }
      if (!entries.length) return;
      let entry = entries[0];

      // Disambiguate using headers - then one with most matching headers wins.
      if (entries.length > 1) {
        const list = [];
        for (const candidate of entries) {
          const matchingHeaders = countMatchingHeaders(candidate.request.headers, headers);
          list.push({
            candidate,
            matchingHeaders
          });
        }
        list.sort((a, b) => b.matchingHeaders - a.matchingHeaders);
        entry = list[0].candidate;
      }
      if (visited.has(entry)) throw new Error(`Found redirect cycle for ${url}`);
      visited.add(entry);

      // Follow redirects.
      const locationHeader = entry.response.headers.find(h => h.name.toLowerCase() === 'location');
      if (redirectStatus.includes(entry.response.status) && locationHeader) {
        const locationURL = new URL(locationHeader.value, url);
        url = locationURL.toString();
        if ((entry.response.status === 301 || entry.response.status === 302) && method === 'POST' || entry.response.status === 303 && !['GET', 'HEAD'].includes(method)) {
          // HTTP-redirect fetch step 13 (https://fetch.spec.whatwg.org/#http-redirect-fetch)
          method = 'GET';
        }
        continue;
      }
      return entry;
    }
  }
  dispose() {
    var _this$_zipFile;
    (_this$_zipFile = this._zipFile) === null || _this$_zipFile === void 0 || _this$_zipFile.close();
  }
}
exports.HarBackend = HarBackend;
function countMatchingHeaders(harHeaders, headers) {
  const set = new Set(headers.map(h => h.name.toLowerCase() + ':' + h.value));
  let matches = 0;
  for (const h of harHeaders) {
    if (set.has(h.name.toLowerCase() + ':' + h.value)) ++matches;
  }
  return matches;
}
function multipartBoundary(headers) {
  const contentType = headers.find(h => h.name.toLowerCase() === 'content-type');
  if (!(contentType !== null && contentType !== void 0 && contentType.value.includes('multipart/form-data'))) return undefined;
  const boundary = contentType.value.match(/boundary=(\S+)/);
  if (boundary) return boundary[1];
  return undefined;
}