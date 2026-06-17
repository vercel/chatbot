/**
 * Autonomous Mission — Git Operations
 *
 * Handles branch creation, committing, pushing, and optional PR creation.
 * All commits signed with abhiswami2121@gmail.com.
 *
 * Phase 38: Autonomous Coding Platform
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const AUTHOR_EMAIL = "abhiswami2121@gmail.com";
const AUTHOR_NAME = "Neptune Autonomous Agent";
const REPO_PATH = process.cwd();

export interface GitResult {
  success: boolean;
  branch?: string;
  commitSha?: string;
  prUrl?: string;
  error?: string;
}

/**
 * Create a new feature branch and switch to it.
 */
export function createBranch(branchName: string): GitResult {
  try {
    // Ensure clean working directory
    const status = execSync("git status --porcelain", { cwd: REPO_PATH, encoding: "utf-8" });
    if (status.trim()) {
      // Stash any uncommitted changes from previous work
      execSync("git stash --include-untracked", { cwd: REPO_PATH });
    }

    // Fetch latest
    execSync("git fetch origin main", { cwd: REPO_PATH });

    // Create branch from main
    execSync(`git checkout -b ${branchName} origin/main`, { cwd: REPO_PATH });

    return { success: true, branch: branchName };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    // Try creating from current HEAD if origin/main fails
    try {
      execSync(`git checkout -b ${branchName}`, { cwd: REPO_PATH });
      return { success: true, branch: branchName };
    } catch {
      return { success: false, error: `Failed to create branch ${branchName}: ${error}` };
    }
  }
}

/**
 * Stage all changes and commit with the given message.
 */
export function commit(message: string): GitResult {
  try {
    // Configure author
    execSync(`git config user.email "${AUTHOR_EMAIL}"`, { cwd: REPO_PATH });
    execSync(`git config user.name "${AUTHOR_NAME}"`, { cwd: REPO_PATH });

    // Check if there's anything to commit
    const status = execSync("git status --porcelain", { cwd: REPO_PATH, encoding: "utf-8" });
    if (!status.trim()) {
      return { success: true, commitSha: "nothing-to-commit" };
    }

    // Stage all changes
    execSync("git add -A", { cwd: REPO_PATH });

    // Commit
    const fullMessage = `${message}\n\nCo-Authored-By: Neptune Autonomous Agent <${AUTHOR_EMAIL}>`;
    execSync(`git commit -m "${fullMessage.replace(/"/g, '\\"')}"`, { cwd: REPO_PATH });

    // Get commit SHA
    const sha = execSync("git rev-parse HEAD", { cwd: REPO_PATH, encoding: "utf-8" }).trim();

    return { success: true, commitSha: sha };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Commit failed: ${error}` };
  }
}

/**
 * Push the current branch to origin with retry logic.
 */
export function push(branchName: string, retries = 3): GitResult {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      execSync(`git push -u origin ${branchName}`, {
        cwd: REPO_PATH,
        timeout: 30000,
      });

      const sha = execSync("git rev-parse HEAD", {
        cwd: REPO_PATH,
        encoding: "utf-8",
      }).trim();

      return { success: true, branch: branchName, commitSha: sha };
    } catch (err) {
      if (attempt === retries) {
        const error = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Push failed after ${retries} attempts: ${error}` };
      }
      // Wait before retry (exponential backoff)
      const delay = attempt * 2000;
      Atomics.wait?.(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay) ||
        new Promise(r => setTimeout(r, delay));
    }
  }

  return { success: false, error: "Push failed" };
}

/**
 * Reset to a previous commit (rollback).
 */
export function rollback(commitSha: string): GitResult {
  try {
    execSync(`git reset --hard ${commitSha}`, { cwd: REPO_PATH });
    return { success: true, commitSha };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Rollback failed: ${error}` };
  }
}

/**
 * Get the current branch name.
 */
export function getCurrentBranch(): string {
  try {
    return execSync("git branch --show-current", {
      cwd: REPO_PATH,
      encoding: "utf-8",
    }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * Get the current HEAD commit SHA.
 */
export function getHeadSha(): string {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: REPO_PATH,
      encoding: "utf-8",
    }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * Check if the working directory is clean.
 */
export function isClean(): boolean {
  try {
    const status = execSync("git status --porcelain", {
      cwd: REPO_PATH,
      encoding: "utf-8",
    });
    return !status.trim();
  } catch {
    return false;
  }
}

/**
 * Get the diff of uncommitted changes.
 */
export function getDiff(): string {
  try {
    return execSync("git diff --stat", {
      cwd: REPO_PATH,
      encoding: "utf-8",
    });
  } catch {
    return "";
  }
}
