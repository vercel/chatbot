"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.addGitCommitInfoPlugin = void 0;
var fs = _interopRequireWildcard(require("fs"));
var _utils = require("playwright-core/lib/utils");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
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

const GIT_OPERATIONS_TIMEOUT_MS = 3000;
const addGitCommitInfoPlugin = fullConfig => {
  fullConfig.plugins.push({
    factory: gitCommitInfoPlugin.bind(null, fullConfig)
  });
};
exports.addGitCommitInfoPlugin = addGitCommitInfoPlugin;
const gitCommitInfoPlugin = fullConfig => {
  return {
    name: 'playwright:git-commit-info',
    setup: async (config, configDir) => {
      var _fullConfig$captureGi, _fullConfig$captureGi2, _fullConfig$captureGi3, _fullConfig$captureGi4;
      const metadata = config.metadata;
      const ci = await ciInfo();
      if (!metadata.ci && ci) metadata.ci = ci;
      if ((_fullConfig$captureGi = fullConfig.captureGitInfo) !== null && _fullConfig$captureGi !== void 0 && _fullConfig$captureGi.commit || ((_fullConfig$captureGi2 = fullConfig.captureGitInfo) === null || _fullConfig$captureGi2 === void 0 ? void 0 : _fullConfig$captureGi2.commit) === undefined && ci) {
        const git = await gitCommitInfo(configDir).catch(e => {
          // eslint-disable-next-line no-console
          console.error('Failed to get git commit info', e);
        });
        if (git) metadata.gitCommit = git;
      }
      if ((_fullConfig$captureGi3 = fullConfig.captureGitInfo) !== null && _fullConfig$captureGi3 !== void 0 && _fullConfig$captureGi3.diff || ((_fullConfig$captureGi4 = fullConfig.captureGitInfo) === null || _fullConfig$captureGi4 === void 0 ? void 0 : _fullConfig$captureGi4.diff) === undefined && ci) {
        const diffResult = await gitDiff(configDir, ci).catch(e => {
          // eslint-disable-next-line no-console
          console.error('Failed to get git diff', e);
        });
        if (diffResult) metadata.gitDiff = diffResult;
      }
    }
  };
};
async function ciInfo() {
  if (process.env.GITHUB_ACTIONS) {
    var _pr, _pr2;
    let pr;
    try {
      const json = JSON.parse(await fs.promises.readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
      pr = {
        title: json.pull_request.title,
        number: json.pull_request.number,
        baseHash: json.pull_request.base.sha
      };
    } catch {}
    return {
      commitHref: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/commit/${process.env.GITHUB_SHA}`,
      commitHash: process.env.GITHUB_SHA,
      prHref: pr ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/pull/${pr.number}` : undefined,
      prTitle: (_pr = pr) === null || _pr === void 0 ? void 0 : _pr.title,
      prBaseHash: (_pr2 = pr) === null || _pr2 === void 0 ? void 0 : _pr2.baseHash,
      buildHref: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    };
  }
  if (process.env.GITLAB_CI) {
    return {
      commitHref: `${process.env.CI_PROJECT_URL}/-/commit/${process.env.CI_COMMIT_SHA}`,
      commitHash: process.env.CI_COMMIT_SHA,
      buildHref: process.env.CI_JOB_URL,
      branch: process.env.CI_COMMIT_REF_NAME
    };
  }
  if (process.env.JENKINS_URL && process.env.BUILD_URL) {
    return {
      commitHref: process.env.BUILD_URL,
      commitHash: process.env.GIT_COMMIT,
      branch: process.env.GIT_BRANCH
    };
  }

  // Open to PRs.
}
async function gitCommitInfo(gitDir) {
  const separator = `---786eec917292---`;
  const tokens = ['%H',
  // commit hash
  '%h',
  // abbreviated commit hash
  '%s',
  // subject
  '%B',
  // raw body (unwrapped subject and body)
  '%an',
  // author name
  '%ae',
  // author email
  '%at',
  // author date, UNIX timestamp
  '%cn',
  // committer name
  '%ce',
  // committer email
  '%ct',
  // committer date, UNIX timestamp
  '' // branch
  ];
  const output = await runGit(`git log -1 --pretty=format:"${tokens.join(separator)}" && git rev-parse --abbrev-ref HEAD`, gitDir);
  if (!output) return undefined;
  const [hash, shortHash, subject, body, authorName, authorEmail, authorTime, committerName, committerEmail, committerTime, branch] = output.split(separator);
  return {
    shortHash,
    hash,
    subject,
    body,
    author: {
      name: authorName,
      email: authorEmail,
      time: +authorTime * 1000
    },
    committer: {
      name: committerName,
      email: committerEmail,
      time: +committerTime * 1000
    },
    branch: branch.trim()
  };
}
async function gitDiff(gitDir, ci) {
  const diffLimit = 100_000;
  if (ci !== null && ci !== void 0 && ci.prBaseHash) {
    await runGit(`git fetch origin ${ci.prBaseHash}`, gitDir);
    const diff = await runGit(`git diff ${ci.prBaseHash} HEAD`, gitDir);
    if (diff) return diff.substring(0, diffLimit);
  }

  // Do not attempt to diff on CI commit.
  if (ci) return;

  // Check dirty state first.
  const uncommitted = await runGit('git diff', gitDir);
  if (uncommitted) return uncommitted.substring(0, diffLimit);

  // Assume non-shallow checkout on local.
  const diff = await runGit('git diff HEAD~1', gitDir);
  return diff === null || diff === void 0 ? void 0 : diff.substring(0, diffLimit);
}
async function runGit(command, cwd) {
  const result = await (0, _utils.spawnAsync)(command, [], {
    stdio: 'pipe',
    cwd,
    timeout: GIT_OPERATIONS_TIMEOUT_MS,
    shell: true
  });
  if (process.env.DEBUG_GIT_COMMIT_INFO && result.code) {
    // eslint-disable-next-line no-console
    console.error(`Failed to run ${command}: ${result.stderr}`);
  }
  return result.code ? undefined : result.stdout.trim();
}