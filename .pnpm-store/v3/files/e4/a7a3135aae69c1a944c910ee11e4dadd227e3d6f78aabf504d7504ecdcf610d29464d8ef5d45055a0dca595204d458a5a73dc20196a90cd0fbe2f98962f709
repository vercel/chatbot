"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Artifact = void 0;
var _channelOwner = require("./channelOwner");
var _stream = require("./stream");
var _fileUtils = require("./fileUtils");
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

class Artifact extends _channelOwner.ChannelOwner {
  static from(channel) {
    return channel._object;
  }
  async pathAfterFinished() {
    if (this._connection.isRemote()) throw new Error(`Path is not available when connecting remotely. Use saveAs() to save a local copy.`);
    return (await this._channel.pathAfterFinished()).value;
  }
  async saveAs(path) {
    if (!this._connection.isRemote()) {
      await this._channel.saveAs({
        path
      });
      return;
    }
    const result = await this._channel.saveAsStream();
    const stream = _stream.Stream.from(result.stream);
    await (0, _fileUtils.mkdirIfNeeded)(this._platform, path);
    await new Promise((resolve, reject) => {
      stream.stream().pipe(this._platform.fs().createWriteStream(path)).on('finish', resolve).on('error', reject);
    });
  }
  async failure() {
    return (await this._channel.failure()).error || null;
  }
  async createReadStream() {
    const result = await this._channel.stream();
    const stream = _stream.Stream.from(result.stream);
    return stream.stream();
  }
  async readIntoBuffer() {
    const stream = await this.createReadStream();
    return await new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', chunk => {
        chunks.push(chunk);
      });
      stream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      stream.on('error', reject);
    });
  }
  async cancel() {
    return await this._channel.cancel();
  }
  async delete() {
    return await this._channel.delete();
  }
}
exports.Artifact = Artifact;