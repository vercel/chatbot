"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.addSuggestedRebaseline = addSuggestedRebaseline;
exports.applySuggestedRebaselines = applySuggestedRebaselines;
exports.clearSuggestedRebaselines = clearSuggestedRebaselines;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _utils = require("playwright-core/lib/utils");
var _utilsBundle = require("playwright-core/lib/utilsBundle");
var _projectUtils = require("./projectUtils");
var _babelBundle = require("../transform/babelBundle");
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

const t = _babelBundle.types;
const suggestedRebaselines = new _utils.MultiMap();
function addSuggestedRebaseline(location, suggestedRebaseline) {
  suggestedRebaselines.set(location.file, {
    location,
    code: suggestedRebaseline
  });
}
function clearSuggestedRebaselines() {
  suggestedRebaselines.clear();
}
async function applySuggestedRebaselines(config, reporter) {
  if (config.config.updateSnapshots === 'none') return;
  if (!suggestedRebaselines.size) return;
  const [project] = (0, _projectUtils.filterProjects)(config.projects, config.cliProjectFilter);
  if (!project) return;
  const patches = [];
  const files = [];
  const gitCache = new Map();
  const patchFile = _path.default.join(project.project.outputDir, 'rebaselines.patch');
  for (const fileName of [...suggestedRebaselines.keys()].sort()) {
    const source = await _fs.default.promises.readFile(fileName, 'utf8');
    const lines = source.split('\n');
    const replacements = suggestedRebaselines.get(fileName);
    const fileNode = (0, _babelBundle.babelParse)(source, fileName, true);
    const ranges = [];
    (0, _babelBundle.traverse)(fileNode, {
      CallExpression: path => {
        const node = path.node;
        if (node.arguments.length < 1) return;
        if (!t.isMemberExpression(node.callee)) return;
        const argument = node.arguments[0];
        if (!t.isStringLiteral(argument) && !t.isTemplateLiteral(argument)) return;
        const prop = node.callee.property;
        if (!prop.loc || !argument.start || !argument.end) return;
        // Replacements are anchored by the location of the call expression.
        // However, replacement text is meant to only replace the first argument.
        for (const replacement of replacements) {
          // In Babel, rows are 1-based, columns are 0-based.
          if (prop.loc.start.line !== replacement.location.line) continue;
          if (prop.loc.start.column + 1 !== replacement.location.column) continue;
          const indent = lines[prop.loc.start.line - 1].match(/^\s*/)[0];
          const newText = replacement.code.replace(/\{indent\}/g, indent);
          ranges.push({
            start: argument.start,
            end: argument.end,
            oldText: source.substring(argument.start, argument.end),
            newText
          });
          // We can have multiple, hopefully equal, replacements for the same location,
          // for example when a single test runs multiple times because of projects or retries.
          // Do not apply multiple replacements for the same assertion.
          break;
        }
      }
    });
    ranges.sort((a, b) => b.start - a.start);
    let result = source;
    for (const range of ranges) result = result.substring(0, range.start) + range.newText + result.substring(range.end);
    const relativeName = _path.default.relative(process.cwd(), fileName);
    files.push(relativeName);
    if (config.config.updateSourceMethod === 'overwrite') {
      await _fs.default.promises.writeFile(fileName, result);
    } else if (config.config.updateSourceMethod === '3way') {
      await _fs.default.promises.writeFile(fileName, applyPatchWithConflictMarkers(source, result));
    } else {
      const gitFolder = findGitRoot(_path.default.dirname(fileName), gitCache);
      const relativeToGit = _path.default.relative(gitFolder || process.cwd(), fileName);
      patches.push(createPatch(relativeToGit, source, result));
    }
  }
  const fileList = files.map(file => '  ' + _utils.colors.dim(file)).join('\n');
  reporter.onStdErr(`\nNew baselines created for:\n\n${fileList}\n`);
  if (config.config.updateSourceMethod === 'patch') {
    await _fs.default.promises.mkdir(_path.default.dirname(patchFile), {
      recursive: true
    });
    await _fs.default.promises.writeFile(patchFile, patches.join('\n'));
    reporter.onStdErr(`\n  ` + _utils.colors.cyan('git apply ' + _path.default.relative(process.cwd(), patchFile)) + '\n');
  }
}
function createPatch(fileName, before, after) {
  const file = fileName.replace(/\\/g, '/');
  const text = _utilsBundle.diff.createPatch(file, before, after, undefined, undefined, {
    context: 3
  });
  return ['diff --git a/' + file + ' b/' + file, '--- a/' + file, '+++ b/' + file, ...text.split('\n').slice(4)].join('\n');
}
function findGitRoot(dir, cache) {
  const result = cache.get(dir);
  if (result !== undefined) return result;
  const gitPath = _path.default.join(dir, '.git');
  if (_fs.default.existsSync(gitPath) && _fs.default.lstatSync(gitPath).isDirectory()) {
    cache.set(dir, dir);
    return dir;
  }
  const parentDir = _path.default.dirname(dir);
  if (dir === parentDir) {
    cache.set(dir, null);
    return null;
  }
  const parentResult = findGitRoot(parentDir, cache);
  cache.set(dir, parentResult);
  return parentResult;
}
function applyPatchWithConflictMarkers(oldText, newText) {
  const diffResult = _utilsBundle.diff.diffLines(oldText, newText);
  let result = '';
  let conflict = false;
  diffResult.forEach(part => {
    if (part.added) {
      if (conflict) {
        result += part.value;
        result += '>>>>>>> SNAPSHOT\n';
        conflict = false;
      } else {
        result += '<<<<<<< HEAD\n';
        result += part.value;
        result += '=======\n';
        conflict = true;
      }
    } else if (part.removed) {
      result += '<<<<<<< HEAD\n';
      result += part.value;
      result += '=======\n';
      conflict = true;
    } else {
      if (conflict) {
        result += '>>>>>>> SNAPSHOT\n';
        conflict = false;
      }
      result += part.value;
    }
  });
  if (conflict) result += '>>>>>>> SNAPSHOT\n';
  return result;
}