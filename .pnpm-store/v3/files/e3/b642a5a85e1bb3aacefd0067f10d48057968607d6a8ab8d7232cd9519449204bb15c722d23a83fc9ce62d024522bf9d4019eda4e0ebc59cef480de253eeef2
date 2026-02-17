"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Chat = void 0;
exports.asString = asString;
var _transport = require("../transport");
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

class Chat {
  constructor(wsEndpoint) {
    this._history = [];
    this._connectionPromise = void 0;
    this._chatSinks = new Map();
    this._wsEndpoint = void 0;
    this._wsEndpoint = wsEndpoint;
  }
  clearHistory() {
    this._history = [];
  }
  async post(prompt) {
    await this._append('user', prompt);
    let text = await asString(await this._post());
    if (text.startsWith('```json') && text.endsWith('```')) text = text.substring('```json'.length, text.length - '```'.length);
    for (let i = 0; i < 3; ++i) {
      try {
        return JSON.parse(text);
      } catch (e) {
        await this._append('user', String(e));
      }
    }
    throw new Error('Failed to parse response: ' + text);
  }
  async _append(user, content) {
    this._history.push({
      user,
      content
    });
  }
  async _connection() {
    if (!this._connectionPromise) {
      this._connectionPromise = _transport.WebSocketTransport.connect(undefined, this._wsEndpoint).then(transport => {
        return new Connection(transport, (method, params) => this._dispatchEvent(method, params), () => {});
      });
    }
    return this._connectionPromise;
  }
  _dispatchEvent(method, params) {
    if (method === 'chatChunk') {
      const {
        chatId,
        chunk
      } = params;
      const chunkSink = this._chatSinks.get(chatId);
      chunkSink(chunk);
      if (!chunk) this._chatSinks.delete(chatId);
    }
  }
  async _post() {
    const connection = await this._connection();
    const result = await connection.send('chat', {
      history: this._history
    });
    const {
      chatId
    } = result;
    const {
      iterable,
      addChunk
    } = iterablePump();
    this._chatSinks.set(chatId, addChunk);
    return iterable;
  }
}
exports.Chat = Chat;
async function asString(stream) {
  let result = '';
  for await (const chunk of stream) result += chunk;
  return result;
}
function iterablePump() {
  let controller;
  const stream = new ReadableStream({
    start: c => controller = c
  });
  const iterable = async function* () {
    const reader = stream.getReader();
    while (true) {
      const {
        done,
        value
      } = await reader.read();
      if (done) break;
      yield value;
    }
  }();
  return {
    iterable,
    addChunk: chunk => {
      if (chunk) controller.enqueue(chunk);else controller.close();
    }
  };
}
class Connection {
  constructor(transport, onEvent, onClose) {
    this._transport = void 0;
    this._lastId = 0;
    this._closed = false;
    this._pending = new Map();
    this._onEvent = void 0;
    this._onClose = void 0;
    this._transport = transport;
    this._onEvent = onEvent;
    this._onClose = onClose;
    this._transport.onmessage = this._dispatchMessage.bind(this);
    this._transport.onclose = this._close.bind(this);
  }
  send(method, params) {
    const id = this._lastId++;
    const message = {
      id,
      method,
      params
    };
    this._transport.send(message);
    return new Promise((resolve, reject) => {
      this._pending.set(id, {
        resolve,
        reject
      });
    });
  }
  _dispatchMessage(message) {
    if (message.id === undefined) {
      this._onEvent(message.method, message.params);
      return;
    }
    const callback = this._pending.get(message.id);
    this._pending.delete(message.id);
    if (!callback) return;
    if (message.error) {
      callback.reject(new Error(message.error.message));
      return;
    }
    callback.resolve(message.result);
  }
  _close() {
    this._closed = true;
    this._transport.onmessage = undefined;
    this._transport.onclose = undefined;
    for (const {
      reject
    } of this._pending.values()) reject(new Error('Connection closed'));
    this._onClose();
  }
  isClosed() {
    return this._closed;
  }
  close() {
    if (!this._closed) this._transport.close();
  }
}