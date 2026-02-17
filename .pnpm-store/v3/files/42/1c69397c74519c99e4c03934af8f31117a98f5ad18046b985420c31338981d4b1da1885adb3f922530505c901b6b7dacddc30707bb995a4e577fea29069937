"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TestRun = void 0;
exports.createApplyRebaselinesTask = createApplyRebaselinesTask;
exports.createClearCacheTask = createClearCacheTask;
exports.createGlobalSetupTasks = createGlobalSetupTasks;
exports.createListFilesTask = createListFilesTask;
exports.createLoadTask = createLoadTask;
exports.createPluginSetupTasks = createPluginSetupTasks;
exports.createReportBeginTask = createReportBeginTask;
exports.createRunTestsTasks = createRunTestsTasks;
exports.createStartDevServerTask = createStartDevServerTask;
exports.runTasks = runTasks;
exports.runTasksDeferCleanup = runTasksDeferCleanup;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _util = require("util");
var _utils = require("playwright-core/lib/utils");
var _utilsBundle = require("playwright-core/lib/utilsBundle");
var _dispatcher = require("./dispatcher");
var _failureTracker = require("./failureTracker");
var _loadUtils = require("./loadUtils");
var _projectUtils = require("./projectUtils");
var _rebase = require("./rebase");
var _taskRunner = require("./taskRunner");
var _vcs = require("./vcs");
var _test = require("../common/test");
var _testGroups = require("../runner/testGroups");
var _compilationCache = require("../transform/compilationCache");
var _util2 = require("../util");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
/**
 * Copyright Microsoft Corporation. All rights reserved.
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

const readDirAsync = (0, _util.promisify)(_fs.default.readdir);
class TestRun {
  constructor(config, reporter) {
    this.config = void 0;
    this.reporter = void 0;
    this.failureTracker = void 0;
    this.rootSuite = undefined;
    this.phases = [];
    this.projectFiles = new Map();
    this.projectSuites = new Map();
    this.config = config;
    this.reporter = reporter;
    this.failureTracker = new _failureTracker.FailureTracker(config);
  }
}
exports.TestRun = TestRun;
async function runTasks(testRun, tasks, globalTimeout, cancelPromise) {
  const deadline = globalTimeout ? (0, _utils.monotonicTime)() + globalTimeout : 0;
  const taskRunner = new _taskRunner.TaskRunner(testRun.reporter, globalTimeout || 0);
  for (const task of tasks) taskRunner.addTask(task);
  testRun.reporter.onConfigure(testRun.config.config);
  const status = await taskRunner.run(testRun, deadline, cancelPromise);
  return await finishTaskRun(testRun, status);
}
async function runTasksDeferCleanup(testRun, tasks) {
  const taskRunner = new _taskRunner.TaskRunner(testRun.reporter, 0);
  for (const task of tasks) taskRunner.addTask(task);
  testRun.reporter.onConfigure(testRun.config.config);
  const {
    status,
    cleanup
  } = await taskRunner.runDeferCleanup(testRun, 0);
  return {
    status: await finishTaskRun(testRun, status),
    cleanup
  };
}
async function finishTaskRun(testRun, status) {
  if (status === 'passed') status = testRun.failureTracker.result();
  const modifiedResult = await testRun.reporter.onEnd({
    status
  });
  if (modifiedResult && modifiedResult.status) status = modifiedResult.status;
  await testRun.reporter.onExit();
  return status;
}
function createGlobalSetupTasks(config) {
  const tasks = [];
  if (!config.configCLIOverrides.preserveOutputDir && !process.env.PW_TEST_NO_REMOVE_OUTPUT_DIRS) tasks.push(createRemoveOutputDirsTask());
  tasks.push(...createPluginSetupTasks(config), ...config.globalTeardowns.map(file => createGlobalTeardownTask(file, config)).reverse(), ...config.globalSetups.map(file => createGlobalSetupTask(file, config)));
  return tasks;
}
function createRunTestsTasks(config) {
  return [createPhasesTask(), createReportBeginTask(), ...config.plugins.map(plugin => createPluginBeginTask(plugin)), createRunTestsTask()];
}
function createClearCacheTask(config) {
  return {
    title: 'clear cache',
    setup: async () => {
      await (0, _util2.removeDirAndLogToConsole)(_compilationCache.cacheDir);
      for (const plugin of config.plugins) {
        var _plugin$instance, _plugin$instance$clea;
        await ((_plugin$instance = plugin.instance) === null || _plugin$instance === void 0 || (_plugin$instance$clea = _plugin$instance.clearCache) === null || _plugin$instance$clea === void 0 ? void 0 : _plugin$instance$clea.call(_plugin$instance));
      }
    }
  };
}
function createReportBeginTask() {
  return {
    title: 'report begin',
    setup: async testRun => {
      var _testRun$reporter$onB, _testRun$reporter;
      (_testRun$reporter$onB = (_testRun$reporter = testRun.reporter).onBegin) === null || _testRun$reporter$onB === void 0 || _testRun$reporter$onB.call(_testRun$reporter, testRun.rootSuite);
    },
    teardown: async ({}) => {}
  };
}
function createPluginSetupTasks(config) {
  return config.plugins.map(plugin => ({
    title: 'plugin setup',
    setup: async ({
      reporter
    }) => {
      var _plugin$instance2, _plugin$instance2$set;
      if (typeof plugin.factory === 'function') plugin.instance = await plugin.factory();else plugin.instance = plugin.factory;
      await ((_plugin$instance2 = plugin.instance) === null || _plugin$instance2 === void 0 || (_plugin$instance2$set = _plugin$instance2.setup) === null || _plugin$instance2$set === void 0 ? void 0 : _plugin$instance2$set.call(_plugin$instance2, config.config, config.configDir, reporter));
    },
    teardown: async () => {
      var _plugin$instance3, _plugin$instance3$tea;
      await ((_plugin$instance3 = plugin.instance) === null || _plugin$instance3 === void 0 || (_plugin$instance3$tea = _plugin$instance3.teardown) === null || _plugin$instance3$tea === void 0 ? void 0 : _plugin$instance3$tea.call(_plugin$instance3));
    }
  }));
}
function createPluginBeginTask(plugin) {
  return {
    title: 'plugin begin',
    setup: async testRun => {
      var _plugin$instance4, _plugin$instance4$beg;
      await ((_plugin$instance4 = plugin.instance) === null || _plugin$instance4 === void 0 || (_plugin$instance4$beg = _plugin$instance4.begin) === null || _plugin$instance4$beg === void 0 ? void 0 : _plugin$instance4$beg.call(_plugin$instance4, testRun.rootSuite));
    },
    teardown: async () => {
      var _plugin$instance5, _plugin$instance5$end;
      await ((_plugin$instance5 = plugin.instance) === null || _plugin$instance5 === void 0 || (_plugin$instance5$end = _plugin$instance5.end) === null || _plugin$instance5$end === void 0 ? void 0 : _plugin$instance5$end.call(_plugin$instance5));
    }
  };
}
function createGlobalSetupTask(file, config) {
  let title = 'global setup';
  if (config.globalSetups.length > 1) title += ` (${file})`;
  let globalSetupResult;
  return {
    title,
    setup: async ({
      config
    }) => {
      const setupHook = await (0, _loadUtils.loadGlobalHook)(config, file);
      globalSetupResult = await setupHook(config.config);
    },
    teardown: async () => {
      if (typeof globalSetupResult === 'function') await globalSetupResult();
    }
  };
}
function createGlobalTeardownTask(file, config) {
  let title = 'global teardown';
  if (config.globalTeardowns.length > 1) title += ` (${file})`;
  return {
    title,
    teardown: async ({
      config
    }) => {
      const teardownHook = await (0, _loadUtils.loadGlobalHook)(config, file);
      await teardownHook(config.config);
    }
  };
}
function createRemoveOutputDirsTask() {
  return {
    title: 'clear output',
    setup: async ({
      config
    }) => {
      const outputDirs = new Set();
      const projects = (0, _projectUtils.filterProjects)(config.projects, config.cliProjectFilter);
      projects.forEach(p => outputDirs.add(p.project.outputDir));
      await Promise.all(Array.from(outputDirs).map(outputDir => (0, _utils.removeFolders)([outputDir]).then(async ([error]) => {
        if (!error) return;
        if (error.code === 'EBUSY') {
          // We failed to remove folder, might be due to the whole folder being mounted inside a container:
          //   https://github.com/microsoft/playwright/issues/12106
          // Do a best-effort to remove all files inside of it instead.
          const entries = await readDirAsync(outputDir).catch(e => []);
          await Promise.all(entries.map(entry => (0, _utils.removeFolders)([_path.default.join(outputDir, entry)])));
        } else {
          throw error;
        }
      })));
    }
  };
}
function createListFilesTask() {
  return {
    title: 'load tests',
    setup: async (testRun, errors) => {
      testRun.rootSuite = await (0, _loadUtils.createRootSuite)(testRun, errors, false);
      testRun.failureTracker.onRootSuite(testRun.rootSuite);
      await (0, _loadUtils.collectProjectsAndTestFiles)(testRun, false);
      for (const [project, files] of testRun.projectFiles) {
        const projectSuite = new _test.Suite(project.project.name, 'project');
        projectSuite._fullProject = project;
        testRun.rootSuite._addSuite(projectSuite);
        const suites = files.map(file => {
          const title = _path.default.relative(testRun.config.config.rootDir, file);
          const suite = new _test.Suite(title, 'file');
          suite.location = {
            file,
            line: 0,
            column: 0
          };
          projectSuite._addSuite(suite);
          return suite;
        });
        testRun.projectSuites.set(project, suites);
      }
    }
  };
}
function createLoadTask(mode, options) {
  return {
    title: 'load tests',
    setup: async (testRun, errors, softErrors) => {
      await (0, _loadUtils.collectProjectsAndTestFiles)(testRun, !!options.doNotRunDepsOutsideProjectFilter);
      await (0, _loadUtils.loadFileSuites)(testRun, mode, options.failOnLoadErrors ? errors : softErrors);
      if (testRun.config.cliOnlyChanged || options.populateDependencies) {
        for (const plugin of testRun.config.plugins) {
          var _plugin$instance6, _plugin$instance6$pop;
          await ((_plugin$instance6 = plugin.instance) === null || _plugin$instance6 === void 0 || (_plugin$instance6$pop = _plugin$instance6.populateDependencies) === null || _plugin$instance6$pop === void 0 ? void 0 : _plugin$instance6$pop.call(_plugin$instance6));
        }
      }
      let cliOnlyChangedMatcher = undefined;
      if (testRun.config.cliOnlyChanged) {
        const changedFiles = await (0, _vcs.detectChangedTestFiles)(testRun.config.cliOnlyChanged, testRun.config.configDir);
        cliOnlyChangedMatcher = file => changedFiles.has(file);
      }
      testRun.rootSuite = await (0, _loadUtils.createRootSuite)(testRun, options.failOnLoadErrors ? errors : softErrors, !!options.filterOnly, cliOnlyChangedMatcher);
      testRun.failureTracker.onRootSuite(testRun.rootSuite);
      // Fail when no tests.
      if (options.failOnLoadErrors && !testRun.rootSuite.allTests().length && !testRun.config.cliPassWithNoTests && !testRun.config.config.shard && !testRun.config.cliOnlyChanged) {
        if (testRun.config.cliArgs.length) {
          throw new Error([`No tests found.`, `Make sure that arguments are regular expressions matching test files.`, `You may need to escape symbols like "$" or "*" and quote the arguments.`].join('\n'));
        }
        throw new Error(`No tests found`);
      }
    }
  };
}
function createApplyRebaselinesTask() {
  return {
    title: 'apply rebaselines',
    setup: async () => {
      (0, _rebase.clearSuggestedRebaselines)();
    },
    teardown: async ({
      config,
      reporter
    }) => {
      await (0, _rebase.applySuggestedRebaselines)(config, reporter);
    }
  };
}
function createPhasesTask() {
  return {
    title: 'create phases',
    setup: async testRun => {
      let maxConcurrentTestGroups = 0;
      const processed = new Set();
      const projectToSuite = new Map(testRun.rootSuite.suites.map(suite => [suite._fullProject, suite]));
      const allProjects = [...projectToSuite.keys()];
      const teardownToSetups = (0, _projectUtils.buildTeardownToSetupsMap)(allProjects);
      const teardownToSetupsDependents = new Map();
      for (const [teardown, setups] of teardownToSetups) {
        const closure = (0, _projectUtils.buildDependentProjects)(setups, allProjects);
        closure.delete(teardown);
        teardownToSetupsDependents.set(teardown, [...closure]);
      }
      for (let i = 0; i < projectToSuite.size; i++) {
        // Find all projects that have all their dependencies processed by previous phases.
        const phaseProjects = [];
        for (const project of projectToSuite.keys()) {
          if (processed.has(project)) continue;
          const projectsThatShouldFinishFirst = [...project.deps, ...(teardownToSetupsDependents.get(project) || [])];
          if (projectsThatShouldFinishFirst.find(p => !processed.has(p))) continue;
          phaseProjects.push(project);
        }

        // Create a new phase.
        for (const project of phaseProjects) processed.add(project);
        if (phaseProjects.length) {
          let testGroupsInPhase = 0;
          const phase = {
            dispatcher: new _dispatcher.Dispatcher(testRun.config, testRun.reporter, testRun.failureTracker),
            projects: []
          };
          testRun.phases.push(phase);
          for (const project of phaseProjects) {
            const projectSuite = projectToSuite.get(project);
            const testGroups = (0, _testGroups.createTestGroups)(projectSuite, testRun.config.config.workers);
            phase.projects.push({
              project,
              projectSuite,
              testGroups
            });
            testGroupsInPhase += testGroups.length;
          }
          (0, _utilsBundle.debug)('pw:test:task')(`created phase #${testRun.phases.length} with ${phase.projects.map(p => p.project.project.name).sort()} projects, ${testGroupsInPhase} testGroups`);
          maxConcurrentTestGroups = Math.max(maxConcurrentTestGroups, testGroupsInPhase);
        }
      }
      testRun.config.config.metadata.actualWorkers = Math.min(testRun.config.config.workers, maxConcurrentTestGroups);
    }
  };
}
function createRunTestsTask() {
  return {
    title: 'test suite',
    setup: async ({
      phases,
      failureTracker
    }) => {
      const successfulProjects = new Set();
      const extraEnvByProjectId = new Map();
      const teardownToSetups = (0, _projectUtils.buildTeardownToSetupsMap)(phases.map(phase => phase.projects.map(p => p.project)).flat());
      for (const {
        dispatcher,
        projects
      } of phases) {
        // Each phase contains dispatcher and a set of test groups.
        // We don't want to run the test groups belonging to the projects
        // that depend on the projects that failed previously.
        const phaseTestGroups = [];
        for (const {
          project,
          testGroups
        } of projects) {
          // Inherit extra environment variables from dependencies.
          let extraEnv = {};
          for (const dep of project.deps) extraEnv = {
            ...extraEnv,
            ...extraEnvByProjectId.get(dep.id)
          };
          for (const setup of teardownToSetups.get(project) || []) extraEnv = {
            ...extraEnv,
            ...extraEnvByProjectId.get(setup.id)
          };
          extraEnvByProjectId.set(project.id, extraEnv);
          const hasFailedDeps = project.deps.some(p => !successfulProjects.has(p));
          if (!hasFailedDeps) phaseTestGroups.push(...testGroups);
        }
        if (phaseTestGroups.length) {
          await dispatcher.run(phaseTestGroups, extraEnvByProjectId);
          await dispatcher.stop();
          for (const [projectId, envProduced] of dispatcher.producedEnvByProjectId()) {
            const extraEnv = extraEnvByProjectId.get(projectId) || {};
            extraEnvByProjectId.set(projectId, {
              ...extraEnv,
              ...envProduced
            });
          }
        }

        // If the worker broke, fail everything, we have no way of knowing which
        // projects failed.
        if (!failureTracker.hasWorkerErrors()) {
          for (const {
            project,
            projectSuite
          } of projects) {
            const hasFailedDeps = project.deps.some(p => !successfulProjects.has(p));
            if (!hasFailedDeps && !projectSuite.allTests().some(test => !test.ok())) successfulProjects.add(project);
          }
        }
      }
    },
    teardown: async ({
      phases
    }) => {
      for (const {
        dispatcher
      } of phases.reverse()) await dispatcher.stop();
    }
  };
}
function createStartDevServerTask() {
  return {
    title: 'start dev server',
    setup: async ({
      config
    }, errors, softErrors) => {
      if (config.plugins.some(plugin => !!plugin.devServerCleanup)) {
        errors.push({
          message: `DevServer is already running`
        });
        return;
      }
      for (const plugin of config.plugins) {
        var _plugin$instance7, _plugin$instance7$sta;
        plugin.devServerCleanup = await ((_plugin$instance7 = plugin.instance) === null || _plugin$instance7 === void 0 || (_plugin$instance7$sta = _plugin$instance7.startDevServer) === null || _plugin$instance7$sta === void 0 ? void 0 : _plugin$instance7$sta.call(_plugin$instance7));
      }
      if (!config.plugins.some(plugin => !!plugin.devServerCleanup)) errors.push({
        message: `DevServer is not available in the package you are using. Did you mean to use component testing?`
      });
    },
    teardown: async ({
      config
    }) => {
      for (const plugin of config.plugins) {
        var _plugin$devServerClea;
        await ((_plugin$devServerClea = plugin.devServerCleanup) === null || _plugin$devServerClea === void 0 ? void 0 : _plugin$devServerClea.call(plugin));
        plugin.devServerCleanup = undefined;
      }
    }
  };
}