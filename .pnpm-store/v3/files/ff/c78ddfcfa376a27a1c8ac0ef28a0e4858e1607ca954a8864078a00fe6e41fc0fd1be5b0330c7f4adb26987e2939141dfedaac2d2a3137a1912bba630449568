"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.requireOrImport = requireOrImport;
exports.resolveHook = resolveHook;
exports.setSingleTSConfig = setSingleTSConfig;
exports.setTransformConfig = setTransformConfig;
exports.setTransformData = setTransformData;
exports.shouldTransform = shouldTransform;
exports.singleTSConfig = singleTSConfig;
exports.transformConfig = transformConfig;
exports.transformHook = transformHook;
exports.wrapFunctionWithLocation = wrapFunctionWithLocation;
var _crypto = _interopRequireDefault(require("crypto"));
var _fs = _interopRequireDefault(require("fs"));
var _module = _interopRequireDefault(require("module"));
var _path = _interopRequireDefault(require("path"));
var _url = _interopRequireDefault(require("url"));
var _tsconfigLoader = require("../third_party/tsconfig-loader");
var _util = require("../util");
var _utilsBundle = require("../utilsBundle");
var _compilationCache = require("./compilationCache");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
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

const version = require('../../package.json').version;
const cachedTSConfigs = new Map();
let _transformConfig = {
  babelPlugins: [],
  external: []
};
let _externalMatcher = () => false;
function setTransformConfig(config) {
  _transformConfig = config;
  _externalMatcher = (0, _util.createFileMatcher)(_transformConfig.external);
}
function transformConfig() {
  return _transformConfig;
}
let _singleTSConfigPath;
let _singleTSConfig;
function setSingleTSConfig(value) {
  _singleTSConfigPath = value;
}
function singleTSConfig() {
  return _singleTSConfigPath;
}
function validateTsConfig(tsconfig) {
  var _tsconfig$absoluteBas, _tsconfig$paths, _tsconfig$paths2;
  // When no explicit baseUrl is set, resolve paths relative to the tsconfig file.
  // See https://www.typescriptlang.org/tsconfig#paths
  const pathsBase = (_tsconfig$absoluteBas = tsconfig.absoluteBaseUrl) !== null && _tsconfig$absoluteBas !== void 0 ? _tsconfig$absoluteBas : (_tsconfig$paths = tsconfig.paths) === null || _tsconfig$paths === void 0 ? void 0 : _tsconfig$paths.pathsBasePath;
  // Only add the catch-all mapping when baseUrl is specified
  const pathsFallback = tsconfig.absoluteBaseUrl ? [{
    key: '*',
    values: ['*']
  }] : [];
  return {
    allowJs: !!tsconfig.allowJs,
    pathsBase,
    paths: Object.entries(((_tsconfig$paths2 = tsconfig.paths) === null || _tsconfig$paths2 === void 0 ? void 0 : _tsconfig$paths2.mapping) || {}).map(([key, values]) => ({
      key,
      values
    })).concat(pathsFallback)
  };
}
function loadAndValidateTsconfigsForFile(file) {
  if (_singleTSConfigPath && !_singleTSConfig) _singleTSConfig = (0, _tsconfigLoader.loadTsConfig)(_singleTSConfigPath).map(validateTsConfig);
  if (_singleTSConfig) return _singleTSConfig;
  return loadAndValidateTsconfigsForFolder(_path.default.dirname(file));
}
function loadAndValidateTsconfigsForFolder(folder) {
  const foldersWithConfig = [];
  let currentFolder = _path.default.resolve(folder);
  let result;
  while (true) {
    const cached = cachedTSConfigs.get(currentFolder);
    if (cached) {
      result = cached;
      break;
    }
    foldersWithConfig.push(currentFolder);
    for (const name of ['tsconfig.json', 'jsconfig.json']) {
      const configPath = _path.default.join(currentFolder, name);
      if (_fs.default.existsSync(configPath)) {
        const loaded = (0, _tsconfigLoader.loadTsConfig)(configPath);
        result = loaded.map(validateTsConfig);
        break;
      }
    }
    if (result) break;
    const parentFolder = _path.default.resolve(currentFolder, '../');
    if (currentFolder === parentFolder) break;
    currentFolder = parentFolder;
  }
  result = result || [];
  for (const folder of foldersWithConfig) cachedTSConfigs.set(folder, result);
  return result;
}
const pathSeparator = process.platform === 'win32' ? ';' : ':';
const builtins = new Set(_module.default.builtinModules);
function resolveHook(filename, specifier) {
  if (specifier.startsWith('node:') || builtins.has(specifier)) return;
  if (!shouldTransform(filename)) return;
  if (isRelativeSpecifier(specifier)) return (0, _util.resolveImportSpecifierAfterMapping)(_path.default.resolve(_path.default.dirname(filename), specifier), false);

  /**
   * TypeScript discourages path-mapping into node_modules:
   * https://www.typescriptlang.org/docs/handbook/modules/reference.html#paths-should-not-point-to-monorepo-packages-or-node_modules-packages
   * However, if path-mapping doesn't yield a result, TypeScript falls back to the default resolution through node_modules.
   */
  const isTypeScript = filename.endsWith('.ts') || filename.endsWith('.tsx');
  const tsconfigs = loadAndValidateTsconfigsForFile(filename);
  for (const tsconfig of tsconfigs) {
    if (!isTypeScript && !tsconfig.allowJs) continue;
    let longestPrefixLength = -1;
    let pathMatchedByLongestPrefix;
    for (const {
      key,
      values
    } of tsconfig.paths) {
      let matchedPartOfSpecifier = specifier;
      const [keyPrefix, keySuffix] = key.split('*');
      if (key.includes('*')) {
        // * If pattern contains '*' then to match pattern "<prefix>*<suffix>" module name must start with the <prefix> and end with <suffix>.
        // * <MatchedStar> denotes part of the module name between <prefix> and <suffix>.
        // * If module name can be matches with multiple patterns then pattern with the longest prefix will be picked.
        // https://github.com/microsoft/TypeScript/blob/f82d0cb3299c04093e3835bc7e29f5b40475f586/src/compiler/moduleNameResolver.ts#L1049
        if (keyPrefix) {
          if (!specifier.startsWith(keyPrefix)) continue;
          matchedPartOfSpecifier = matchedPartOfSpecifier.substring(keyPrefix.length, matchedPartOfSpecifier.length);
        }
        if (keySuffix) {
          if (!specifier.endsWith(keySuffix)) continue;
          matchedPartOfSpecifier = matchedPartOfSpecifier.substring(0, matchedPartOfSpecifier.length - keySuffix.length);
        }
      } else {
        if (specifier !== key) continue;
        matchedPartOfSpecifier = specifier;
      }
      if (keyPrefix.length <= longestPrefixLength) continue;
      for (const value of values) {
        let candidate = value;
        if (value.includes('*')) candidate = candidate.replace('*', matchedPartOfSpecifier);
        candidate = _path.default.resolve(tsconfig.pathsBase, candidate);
        const existing = (0, _util.resolveImportSpecifierAfterMapping)(candidate, true);
        if (existing) {
          longestPrefixLength = keyPrefix.length;
          pathMatchedByLongestPrefix = existing;
        }
      }
    }
    if (pathMatchedByLongestPrefix) return pathMatchedByLongestPrefix;
  }
  if (_path.default.isAbsolute(specifier)) {
    // Handle absolute file paths like `import '/path/to/file'`
    // Do not handle module imports like `import 'fs'`
    return (0, _util.resolveImportSpecifierAfterMapping)(specifier, false);
  }
}
function shouldTransform(filename) {
  if (_externalMatcher(filename)) return false;
  return !(0, _compilationCache.belongsToNodeModules)(filename);
}
let transformData;
function setTransformData(pluginName, value) {
  transformData.set(pluginName, value);
}
function transformHook(originalCode, filename, moduleUrl) {
  const hasPreprocessor = process.env.PW_TEST_SOURCE_TRANSFORM && process.env.PW_TEST_SOURCE_TRANSFORM_SCOPE && process.env.PW_TEST_SOURCE_TRANSFORM_SCOPE.split(pathSeparator).some(f => filename.startsWith(f));
  const pluginsPrologue = _transformConfig.babelPlugins;
  const pluginsEpilogue = hasPreprocessor ? [[process.env.PW_TEST_SOURCE_TRANSFORM]] : [];
  const hash = calculateHash(originalCode, filename, !!moduleUrl, pluginsPrologue, pluginsEpilogue);
  const {
    cachedCode,
    addToCache,
    serializedCache
  } = (0, _compilationCache.getFromCompilationCache)(filename, hash, moduleUrl);
  if (cachedCode !== undefined) return {
    code: cachedCode,
    serializedCache
  };

  // We don't use any browserslist data, but babel checks it anyway.
  // Silence the annoying warning.
  process.env.BROWSERSLIST_IGNORE_OLD_DATA = 'true';
  const {
    babelTransform
  } = require('./babelBundle');
  transformData = new Map();
  const babelResult = babelTransform(originalCode, filename, !!moduleUrl, pluginsPrologue, pluginsEpilogue);
  if (!(babelResult !== null && babelResult !== void 0 && babelResult.code)) return {
    code: originalCode,
    serializedCache
  };
  const {
    code,
    map
  } = babelResult;
  const added = addToCache(code, map, transformData);
  return {
    code,
    serializedCache: added.serializedCache
  };
}
function calculateHash(content, filePath, isModule, pluginsPrologue, pluginsEpilogue) {
  const hash = _crypto.default.createHash('sha1').update(isModule ? 'esm' : 'no_esm').update(content).update(filePath).update(version).update(pluginsPrologue.map(p => p[0]).join(',')).update(pluginsEpilogue.map(p => p[0]).join(',')).digest('hex');
  return hash;
}
async function requireOrImport(file) {
  installTransformIfNeeded();
  const isModule = (0, _util.fileIsModule)(file);
  const esmImport = () => eval(`import(${JSON.stringify(_url.default.pathToFileURL(file))})`);
  if (isModule) return await esmImport();
  const result = require(file);
  const depsCollector = (0, _compilationCache.currentFileDepsCollector)();
  if (depsCollector) {
    const module = require.cache[file];
    if (module) collectCJSDependencies(module, depsCollector);
  }
  return result;
}
let transformInstalled = false;
function installTransformIfNeeded() {
  if (transformInstalled) return;
  transformInstalled = true;
  (0, _compilationCache.installSourceMapSupport)();
  const originalResolveFilename = _module.default._resolveFilename;
  function resolveFilename(specifier, parent, ...rest) {
    if (parent) {
      const resolved = resolveHook(parent.filename, specifier);
      if (resolved !== undefined) specifier = resolved;
    }
    return originalResolveFilename.call(this, specifier, parent, ...rest);
  }
  _module.default._resolveFilename = resolveFilename;
  _utilsBundle.pirates.addHook((code, filename) => {
    if (!shouldTransform(filename)) return code;
    return transformHook(code, filename).code;
  }, {
    exts: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts', '.cjs', '.cts']
  });
}
const collectCJSDependencies = (module, dependencies) => {
  module.children.forEach(child => {
    if (!(0, _compilationCache.belongsToNodeModules)(child.filename) && !dependencies.has(child.filename)) {
      dependencies.add(child.filename);
      collectCJSDependencies(child, dependencies);
    }
  });
};
function wrapFunctionWithLocation(func) {
  return (...args) => {
    const oldPrepareStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = (error, stackFrames) => {
      const frame = _utilsBundle.sourceMapSupport.wrapCallSite(stackFrames[1]);
      const fileName = frame.getFileName();
      // Node error stacks for modules use file:// urls instead of paths.
      const file = fileName && fileName.startsWith('file://') ? _url.default.fileURLToPath(fileName) : fileName;
      return {
        file,
        line: frame.getLineNumber(),
        column: frame.getColumnNumber()
      };
    };
    const oldStackTraceLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = 2;
    const obj = {};
    Error.captureStackTrace(obj);
    const location = obj.stack;
    Error.stackTraceLimit = oldStackTraceLimit;
    Error.prepareStackTrace = oldPrepareStackTrace;
    return func(location, ...args);
  };
}
function isRelativeSpecifier(specifier) {
  return specifier === '.' || specifier === '..' || specifier.startsWith('./') || specifier.startsWith('../');
}