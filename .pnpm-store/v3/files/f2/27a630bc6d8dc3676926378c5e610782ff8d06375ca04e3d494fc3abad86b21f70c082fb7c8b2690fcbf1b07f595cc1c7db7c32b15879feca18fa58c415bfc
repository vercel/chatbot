"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.addStackToTracingNoReply = addStackToTracingNoReply;
exports.harClose = harClose;
exports.harLookup = harLookup;
exports.harOpen = harOpen;
exports.harUnzip = harUnzip;
exports.traceDiscarded = traceDiscarded;
exports.tracingStarted = tracingStarted;
exports.zip = zip;
var _fs = _interopRequireDefault(require("fs"));
var _os = _interopRequireDefault(require("os"));
var _path = _interopRequireDefault(require("path"));
var _crypto = require("./utils/crypto");
var _harBackend = require("./harBackend");
var _manualPromise = require("../utils/isomorphic/manualPromise");
var _zipFile = require("./utils/zipFile");
var _zipBundle = require("../zipBundle");
var _traceUtils = require("../utils/isomorphic/traceUtils");
var _assert = require("../utils/isomorphic/assert");
var _fileUtils = require("./utils/fileUtils");
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

async function zip(stackSessions, params) {
  const promise = new _manualPromise.ManualPromise();
  const zipFile = new _zipBundle.yazl.ZipFile();
  zipFile.on('error', error => promise.reject(error));
  const addFile = (file, name) => {
    try {
      if (_fs.default.statSync(file).isFile()) zipFile.addFile(file, name);
    } catch (e) {}
  };
  for (const entry of params.entries) addFile(entry.value, entry.name);

  // Add stacks and the sources.
  const stackSession = params.stacksId ? stackSessions.get(params.stacksId) : undefined;
  if (stackSession !== null && stackSession !== void 0 && stackSession.callStacks.length) {
    await stackSession.writer;
    if (process.env.PW_LIVE_TRACE_STACKS) {
      zipFile.addFile(stackSession.file, 'trace.stacks');
    } else {
      const buffer = Buffer.from(JSON.stringify((0, _traceUtils.serializeClientSideCallMetadata)(stackSession.callStacks)));
      zipFile.addBuffer(buffer, 'trace.stacks');
    }
  }

  // Collect sources from stacks.
  if (params.includeSources) {
    const sourceFiles = new Set();
    for (const {
      stack
    } of (stackSession === null || stackSession === void 0 ? void 0 : stackSession.callStacks) || []) {
      if (!stack) continue;
      for (const {
        file
      } of stack) sourceFiles.add(file);
    }
    for (const sourceFile of sourceFiles) addFile(sourceFile, 'resources/src@' + (await (0, _crypto.calculateSha1)(sourceFile)) + '.txt');
  }
  if (params.mode === 'write') {
    // New file, just compress the entries.
    await _fs.default.promises.mkdir(_path.default.dirname(params.zipFile), {
      recursive: true
    });
    zipFile.end(undefined, () => {
      zipFile.outputStream.pipe(_fs.default.createWriteStream(params.zipFile)).on('close', () => promise.resolve()).on('error', error => promise.reject(error));
    });
    await promise;
    await deleteStackSession(stackSessions, params.stacksId);
    return;
  }

  // File already exists. Repack and add new entries.
  const tempFile = params.zipFile + '.tmp';
  await _fs.default.promises.rename(params.zipFile, tempFile);
  _zipBundle.yauzl.open(tempFile, (err, inZipFile) => {
    if (err) {
      promise.reject(err);
      return;
    }
    (0, _assert.assert)(inZipFile);
    let pendingEntries = inZipFile.entryCount;
    inZipFile.on('entry', entry => {
      inZipFile.openReadStream(entry, (err, readStream) => {
        if (err) {
          promise.reject(err);
          return;
        }
        zipFile.addReadStream(readStream, entry.fileName);
        if (--pendingEntries === 0) {
          zipFile.end(undefined, () => {
            zipFile.outputStream.pipe(_fs.default.createWriteStream(params.zipFile)).on('close', () => {
              _fs.default.promises.unlink(tempFile).then(() => {
                promise.resolve();
              }).catch(error => promise.reject(error));
            });
          });
        }
      });
    });
  });
  await promise;
  await deleteStackSession(stackSessions, params.stacksId);
}
async function deleteStackSession(stackSessions, stacksId) {
  const session = stacksId ? stackSessions.get(stacksId) : undefined;
  if (!session) return;
  await session.writer;
  if (session.tmpDir) await (0, _fileUtils.removeFolders)([session.tmpDir]);
  stackSessions.delete(stacksId);
}
async function harOpen(harBackends, params) {
  let harBackend;
  if (params.file.endsWith('.zip')) {
    const zipFile = new _zipFile.ZipFile(params.file);
    const entryNames = await zipFile.entries();
    const harEntryName = entryNames.find(e => e.endsWith('.har'));
    if (!harEntryName) return {
      error: 'Specified archive does not have a .har file'
    };
    const har = await zipFile.read(harEntryName);
    const harFile = JSON.parse(har.toString());
    harBackend = new _harBackend.HarBackend(harFile, null, zipFile);
  } else {
    const harFile = JSON.parse(await _fs.default.promises.readFile(params.file, 'utf-8'));
    harBackend = new _harBackend.HarBackend(harFile, _path.default.dirname(params.file), null);
  }
  harBackends.set(harBackend.id, harBackend);
  return {
    harId: harBackend.id
  };
}
async function harLookup(harBackends, params) {
  const harBackend = harBackends.get(params.harId);
  if (!harBackend) return {
    action: 'error',
    message: `Internal error: har was not opened`
  };
  return await harBackend.lookup(params.url, params.method, params.headers, params.postData, params.isNavigationRequest);
}
async function harClose(harBackends, params) {
  const harBackend = harBackends.get(params.harId);
  if (harBackend) {
    harBackends.delete(harBackend.id);
    harBackend.dispose();
  }
}
async function harUnzip(params) {
  const dir = _path.default.dirname(params.zipFile);
  const zipFile = new _zipFile.ZipFile(params.zipFile);
  for (const entry of await zipFile.entries()) {
    const buffer = await zipFile.read(entry);
    if (entry === 'har.har') await _fs.default.promises.writeFile(params.harFile, buffer);else await _fs.default.promises.writeFile(_path.default.join(dir, entry), buffer);
  }
  zipFile.close();
  await _fs.default.promises.unlink(params.zipFile);
}
async function tracingStarted(stackSessions, params) {
  let tmpDir = undefined;
  if (!params.tracesDir) tmpDir = await _fs.default.promises.mkdtemp(_path.default.join(_os.default.tmpdir(), 'playwright-tracing-'));
  const traceStacksFile = _path.default.join(params.tracesDir || tmpDir, params.traceName + '.stacks');
  stackSessions.set(traceStacksFile, {
    callStacks: [],
    file: traceStacksFile,
    writer: Promise.resolve(),
    tmpDir
  });
  return {
    stacksId: traceStacksFile
  };
}
async function traceDiscarded(stackSessions, params) {
  await deleteStackSession(stackSessions, params.stacksId);
}
async function addStackToTracingNoReply(stackSessions, params) {
  for (const session of stackSessions.values()) {
    session.callStacks.push(params.callData);
    if (process.env.PW_LIVE_TRACE_STACKS) {
      session.writer = session.writer.then(() => {
        const buffer = Buffer.from(JSON.stringify((0, _traceUtils.serializeClientSideCallMetadata)(session.callStacks)));
        return _fs.default.promises.writeFile(session.file, buffer);
      });
    }
  }
}