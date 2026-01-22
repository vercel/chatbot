"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Runner = void 0;
var _lastRun = require("./lastRun");
var _projectUtils = require("./projectUtils");
var _reporters = require("./reporters");
var _tasks = require("./tasks");
var _gitCommitInfoPlugin = require("../plugins/gitCommitInfoPlugin");
var _webServerPlugin = require("../plugins/webServerPlugin");
var _base = require("../reporters/base");
var _internalReporter = require("../reporters/internalReporter");
var _compilationCache = require("../transform/compilationCache");
/**
 * Copyright 2019 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class Runner {
  constructor(config) {
    this._config = void 0;
    this._config = config;
  }
  async listTestFiles(projectNames) {
    const projects = (0, _projectUtils.filterProjects)(this._config.projects, projectNames);
    const report = {
      projects: []
    };
    for (const project of projects) {
      report.projects.push({
        name: project.project.name,
        testDir: project.project.testDir,
        use: {
          testIdAttribute: project.project.use.testIdAttribute
        },
        files: await (0, _projectUtils.collectFilesForProject)(project)
      });
    }
    return report;
  }
  async runAllTests() {
    const config = this._config;
    const listOnly = config.cliListOnly;
    (0, _gitCommitInfoPlugin.addGitCommitInfoPlugin)(config);

    // Legacy webServer support.
    (0, _webServerPlugin.webServerPluginsForConfig)(config).forEach(p => config.plugins.push({
      factory: p
    }));
    const reporters = await (0, _reporters.createReporters)(config, listOnly ? 'list' : 'test', false);
    const lastRun = new _lastRun.LastRunReporter(config);
    if (config.cliLastFailed) await lastRun.filterLastFailed();
    const reporter = new _internalReporter.InternalReporter([...reporters, lastRun]);
    const tasks = listOnly ? [(0, _tasks.createLoadTask)('in-process', {
      failOnLoadErrors: true,
      filterOnly: false
    }), (0, _tasks.createReportBeginTask)()] : [(0, _tasks.createApplyRebaselinesTask)(), ...(0, _tasks.createGlobalSetupTasks)(config), (0, _tasks.createLoadTask)('in-process', {
      filterOnly: true,
      failOnLoadErrors: true
    }), ...(0, _tasks.createRunTestsTasks)(config)];
    const status = await (0, _tasks.runTasks)(new _tasks.TestRun(config, reporter), tasks, config.config.globalTimeout);

    // Calling process.exit() might truncate large stdout/stderr output.
    // See https://github.com/nodejs/node/issues/6456.
    // See https://github.com/nodejs/node/issues/12921
    await new Promise(resolve => process.stdout.write('', () => resolve()));
    await new Promise(resolve => process.stderr.write('', () => resolve()));
    return status;
  }
  async findRelatedTestFiles(files) {
    const errorReporter = (0, _reporters.createErrorCollectingReporter)(_base.terminalScreen);
    const reporter = new _internalReporter.InternalReporter([errorReporter]);
    const status = await (0, _tasks.runTasks)(new _tasks.TestRun(this._config, reporter), [...(0, _tasks.createPluginSetupTasks)(this._config), (0, _tasks.createLoadTask)('in-process', {
      failOnLoadErrors: true,
      filterOnly: false,
      populateDependencies: true
    })]);
    if (status !== 'passed') return {
      errors: errorReporter.errors(),
      testFiles: []
    };
    return {
      testFiles: (0, _compilationCache.affectedTestFiles)(files)
    };
  }
  async runDevServer() {
    const reporter = new _internalReporter.InternalReporter([(0, _reporters.createErrorCollectingReporter)(_base.terminalScreen, true)]);
    const status = await (0, _tasks.runTasks)(new _tasks.TestRun(this._config, reporter), [...(0, _tasks.createPluginSetupTasks)(this._config), (0, _tasks.createLoadTask)('in-process', {
      failOnLoadErrors: true,
      filterOnly: false
    }), (0, _tasks.createStartDevServerTask)(), {
      title: 'wait until interrupted',
      setup: async () => new Promise(() => {})
    }]);
    return {
      status
    };
  }
  async clearCache() {
    const reporter = new _internalReporter.InternalReporter([(0, _reporters.createErrorCollectingReporter)(_base.terminalScreen, true)]);
    const status = await (0, _tasks.runTasks)(new _tasks.TestRun(this._config, reporter), [...(0, _tasks.createPluginSetupTasks)(this._config), (0, _tasks.createClearCacheTask)(this._config)]);
    return {
      status
    };
  }
}
exports.Runner = Runner;