/**
 * lib/self-coding/code-apply.ts — Direct Code Application via GitHub API
 *
 * M-N-SELF-CODING (2026-06-21): Neptune Chat applies code directly to
 * abhiswami2121 repos using the GitHub REST API, without V2 handoff.
 *
 * Uses the existing GitHub connector infrastructure (secrets.github.token)
 * but adds direct git operations (branch creation, file commits, PR creation)
 * that go beyond the read/search tools in the GitHub connector.
 *
 * Architecture:
 *   codeApply() → createBranch() → commitFiles() → openPR() → return PR URL
 *
 * All operations use GitHub REST API directly (no git CLI), meaning this
 * works from Vercel serverless functions with no filesystem access needed.
 */

import { secrets } from "@/secrets";
import type { CodingLane } from "./workflow";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CodeApplyInput {
  /** Repository name (e.g., "neptune-chat") */
  repo: string;
  /** Repository owner (default: abhiswami2121) */
  owner?: string;
  /** Base branch to branch from (default: main) */
  baseBranch?: string;
  /** Task/goal description */
  goal: string;
  /** Files to create or modify */
  files: FileChangeInput[];
  /** PR title (auto-generated if not provided) */
  prTitle?: string;
  /** PR description (auto-generated if not provided) */
  prBody?: string;
  /** Commit message prefix */
  commitPrefix?: string;
  /** Lane that initiated this apply */
  lane?: CodingLane;
}

export interface FileChangeInput {
  /** File path relative to repo root */
  path: string;
  /** New file content */
  content: string;
  /** Change type */
  operation: "create" | "update" | "delete";
  /** Encoding (default: utf-8) */
  encoding?: "utf-8" | "base64";
}

export interface CodeApplyResult {
  success: boolean;
  /** Generated branch name */
  branch?: string;
  /** PR number (if PR was created) */
  prNumber?: number;
  /** PR URL */
  prUrl?: string;
  /** Files that were successfully committed */
  committedFiles: string[];
  /** Files that failed */
  failedFiles: { path: string; error: string }[];
  /** Commit SHA for each file */
  commits: { path: string; sha: string }[];
  error?: string;
}

export interface BranchInfo {
  name: string;
  sha: string;
  exists: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────

const GITHUB_API = "https://api.github.com";
const DEFAULT_OWNER = "abhiswami2121";
const DEFAULT_BASE = "main";

function githubHeaders(): Record<string, string> {
  const token = secrets.github?.token || "";
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// ── Core GitHub API Helpers ────────────────────────────────────────────────

async function ghApi(
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  body?: unknown
): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  const token = secrets.github?.token;
  if (!token) {
    return { ok: false, status: 401, error: "GITHUB_TOKEN not configured" };
  }

  try {
    const res = await fetch(`${GITHUB_API}${path}`, {
      method,
      headers: githubHeaders(),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!res.ok) {
      const errMsg = typeof data === "object" && data !== null
        ? (data as Record<string, unknown>).message || text
        : text;
      return { ok: false, status: res.status, error: String(errMsg) };
    }

    return { ok: true, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "GitHub API unreachable",
    };
  }
}

// ── Branch Operations ──────────────────────────────────────────────────────

/**
 * Get the SHA of the base branch's HEAD.
 */
async function getBaseRef(owner: string, repo: string, base: string): Promise<string | null> {
  const res = await ghApi(`/repos/${owner}/${repo}/git/ref/heads/${base}`);
  if (res.ok && res.data) {
    return ((res.data as Record<string, unknown>).object as Record<string, unknown>)?.sha as string || null;
  }
  return null;
}

/**
 * Create a new branch from the base branch.
 */
async function createBranch(
  owner: string,
  repo: string,
  branchName: string,
  baseSha: string
): Promise<BranchInfo> {
  const res = await ghApi(`/repos/${owner}/${repo}/git/refs`, "POST", {
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  });

  if (res.ok && res.data) {
    const data = res.data as Record<string, unknown>;
    return {
      name: branchName,
      sha: (data.object as Record<string, unknown>)?.sha as string || "",
      exists: true,
    };
  }

  // Check if branch already exists
  if (res.status === 422) {
    const existing = await ghApi(`/repos/${owner}/${repo}/git/ref/heads/${branchName}`);
    if (existing.ok && existing.data) {
      const ed = existing.data as Record<string, unknown>;
      return {
        name: branchName,
        sha: (ed.object as Record<string, unknown>)?.sha as string || "",
        exists: true,
      };
    }
  }

  return { name: branchName, sha: "", exists: false };
}

// ── File Operations ────────────────────────────────────────────────────────

/**
 * Get the current SHA of a file (needed for updates).
 */
async function getFileSha(
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<string | null> {
  const res = await ghApi(
    `/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
  );
  if (res.ok && res.data) {
    return (res.data as Record<string, unknown>).sha as string || null;
  }
  return null;
}

/**
 * Create or update a single file via GitHub Contents API.
 * For updates, we need the blob SHA of the file being replaced.
 */
async function putFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  branch: string,
  message: string,
  operation: "create" | "update" | "delete"
): Promise<{ ok: boolean; sha?: string; error?: string }> {
  const body: Record<string, unknown> = {
    message,
    branch,
    content: Buffer.from(content, "utf-8").toString("base64"),
  };

  // For updates, we need the SHA of the existing file
  if (operation === "update") {
    const existingSha = await getFileSha(owner, repo, path, branch);
    if (existingSha) {
      body.sha = existingSha;
    } else {
      // File doesn't exist yet — treat as create
      body.message = `create: ${message}`;
    }
  }

  const res = await ghApi(
    `/repos/${owner}/${repo}/contents/${path}`,
    "PUT",
    body
  );

  if (res.ok && res.data) {
    const data = res.data as Record<string, unknown>;
    return {
      ok: true,
      sha: (data.content as Record<string, unknown>)?.sha as string || "",
    };
  }

  return { ok: false, error: res.error };
}

// ── PR Operations ──────────────────────────────────────────────────────────

/**
 * Create a pull request.
 */
async function createPR(
  owner: string,
  repo: string,
  title: string,
  head: string,
  base: string,
  body: string
): Promise<{ number?: number; url?: string; error?: string }> {
  const res = await ghApi(`/repos/${owner}/${repo}/pulls`, "POST", {
    title,
    head,
    base,
    body,
  });

  if (res.ok && res.data) {
    const data = res.data as Record<string, unknown>;
    return {
      number: data.number as number,
      url: data.html_url as string,
    };
  }

  return { error: res.error };
}

// ── Main Code Apply Function ───────────────────────────────────────────────

/**
 * Apply code changes directly to a GitHub repository.
 *
 * Flow:
 *   1. Generate a unique branch name
 *   2. Create branch from base
 *   3. For each file: create/update/delete via Contents API
 *   4. Open a PR from the branch
 *   5. Return PR URL for deploy step
 *
 * @param input - CodeApplyInput with repo, files, and goal
 * @returns CodeApplyResult with PR URL and file status
 */
export async function codeApply(input: CodeApplyInput): Promise<CodeApplyResult> {
  const owner = input.owner || DEFAULT_OWNER;
  const repo = input.repo;
  const baseBranch = input.baseBranch || DEFAULT_BASE;

  // Validate inputs
  if (!secrets.github?.token) {
    return {
      success: false,
      error: "GITHUB_TOKEN not configured — cannot apply code directly",
      committedFiles: [],
      failedFiles: [],
      commits: [],
    };
  }

  if (input.files.length === 0) {
    return {
      success: false,
      error: "No files provided to apply",
      committedFiles: [],
      failedFiles: [],
      commits: [],
    };
  }

  // ── Step 1: Check token scope ──
  const tokenCheck = await ghApi("/user");
  if (!tokenCheck.ok) {
    return {
      success: false,
      error: `GitHub auth failed: ${tokenCheck.error}. Token may need repo scope.`,
      committedFiles: [],
      failedFiles: [],
      commits: [],
    };
  }

  // ── Step 2: Generate branch name ──
  const timestamp = Date.now();
  const goalSlug = input.goal
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  const branchName = `feat/self-code-${goalSlug}-${timestamp}`;

  // ── Step 3: Get base ref SHA ──
  const baseSha = await getBaseRef(owner, repo, baseBranch);
  if (!baseSha) {
    return {
      success: false,
      error: `Could not resolve base branch: ${baseBranch}`,
      committedFiles: [],
      failedFiles: [],
      commits: [],
    };
  }

  // ── Step 4: Create branch ──
  const branch = await createBranch(owner, repo, branchName, baseSha);
  if (!branch.exists) {
    return {
      success: false,
      error: `Failed to create branch: ${branchName}`,
      committedFiles: [],
      failedFiles: [],
      commits: [],
    };
  }

  console.log(`[code-apply] Created branch: ${branchName} (SHA: ${branch.sha})`);

  // ── Step 5: Commit files ──
  const committedFiles: string[] = [];
  const failedFiles: { path: string; error: string }[] = [];
  const commits: { path: string; sha: string }[] = [];

  const commitPrefix = input.commitPrefix || "feat(self-code)";

  for (const file of input.files) {
    const commitMessage = `${commitPrefix}: ${file.operation} ${file.path}`;
    const result = await putFile(
      owner,
      repo,
      file.path,
      file.content,
      branchName,
      commitMessage,
      file.operation
    );

    if (result.ok && result.sha) {
      committedFiles.push(file.path);
      commits.push({ path: file.path, sha: result.sha });
      console.log(`[code-apply] ✓ ${file.operation}: ${file.path}`);
    } else {
      failedFiles.push({ path: file.path, error: result.error || "Unknown error" });
      console.error(`[code-apply] ✗ ${file.operation}: ${file.path} — ${result.error}`);
    }
  }

  // If all files failed, abort
  if (committedFiles.length === 0) {
    return {
      success: false,
      branch: branchName,
      error: "All file commits failed",
      committedFiles: [],
      failedFiles,
      commits,
    };
  }

  // ── Step 6: Open PR ──
  const prTitle = input.prTitle ||
    `feat(self-code): ${input.goal.slice(0, 70)}`;

  const prBody = input.prBody || [
    `## Self-Coded Change`,
    ``,
    `**Goal:** ${input.goal}`,
    ``,
    `**Files changed (${committedFiles.length}):**`,
    ...committedFiles.map((f) => `- \`${f}\``),
    ``,
    `**Lane:** ${input.lane || "self"} — applied directly by Neptune Chat`,
    ``,
    `> 🤖 Generated with Neptune Chat Self-Coding Engine`,
  ].join("\n");

  const pr = await createPR(owner, repo, prTitle, branchName, baseBranch, prBody);

  if (pr.number) {
    console.log(`[code-apply] ✅ PR #${pr.number} opened: ${pr.url}`);
  } else {
    console.warn(`[code-apply] ⚠️ PR creation failed: ${pr.error}. Branch ${branchName} has changes.`);
  }

  return {
    success: committedFiles.length > 0,
    branch: branchName,
    prNumber: pr.number,
    prUrl: pr.url,
    committedFiles,
    failedFiles,
    commits,
    error: failedFiles.length > 0
      ? `${failedFiles.length} file(s) failed to commit`
      : undefined,
  };
}

/**
 * Quick single-file code apply.
 * Convenience wrapper around codeApply() for a single file change.
 */
export async function quickCodeApply(
  repo: string,
  filePath: string,
  content: string,
  goal: string,
  operation: FileChangeInput["operation"] = "update",
  options?: { owner?: string; baseBranch?: string }
): Promise<CodeApplyResult> {
  return codeApply({
    repo,
    owner: options?.owner,
    baseBranch: options?.baseBranch,
    goal,
    files: [{ path: filePath, content, operation }],
    lane: "self",
  });
}
