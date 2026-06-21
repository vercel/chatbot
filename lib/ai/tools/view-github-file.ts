/**
 * view-github-file.ts — GitHub Contents API file reader
 *
 * M-NEPTUNE-GAPS-CLOSE-AND-LAND Part B1 (2026-06-21)
 *
 * Reads arbitrary files from any GitHub repository using the GitHub Contents API.
 * Includes a 5-minute in-memory TTL cache to avoid rate limits.
 *
 * Schema:
 *   { repo: string (owner/name), path: string, ref?: string (branch/sha, default 'main') }
 * Returns:
 *   { content: string, size: number, sha: string, encoding: string, html_url: string }
 */

import { tool } from "ai";
import { z } from "zod";
import { secrets } from "@/secrets";

const GITHUB_TOKEN = secrets.github.token;

// ── 5-minute TTL Cache ──────────────────────────────────────────────────────

interface CacheEntry {
  data: ViewFileResult;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheKey(repo: string, path: string, ref: string): string {
  return `${repo}::${path}::${ref}`;
}

function getCached(key: string): ViewFileResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: ViewFileResult): void {
  cache.set(key, { data, cachedAt: Date.now() });

  // Prevent unbounded growth — evict oldest if > 500 entries
  if (cache.size > 500) {
    let oldestKey = "";
    let oldestTime = Infinity;
    for (const [k, v] of cache) {
      if (v.cachedAt < oldestTime) {
        oldestTime = v.cachedAt;
        oldestKey = k;
      }
    }
    cache.delete(oldestKey);
  }
}

// ── Result Types ────────────────────────────────────────────────────────────

export interface ViewFileResult {
  content: string;
  size: number;
  sha: string;
  encoding: string;
  html_url: string;
  path: string;
  repo: string;
  ref: string;
  cached?: boolean;
}

interface ViewFileError {
  error: string;
  repo: string;
  path: string;
  ref: string;
  status?: number;
}

// ── GitHub API Helper ───────────────────────────────────────────────────────

async function ghApi(path: string): Promise<unknown> {
  if (!GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN not configured");
  }
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "Neptune-Chat/3.1 (view-github-file)",
    },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    const error = new Error(`GitHub API ${res.status}: ${err.slice(0, 300)}`) as Error & { status: number };
    error.status = res.status;
    throw error;
  }
  return res.json();
}

// ── Tool Definition ─────────────────────────────────────────────────────────

export const viewGithubFile = tool({
  description:
    "Read a file from ANY GitHub repository using the GitHub Contents API. " +
    "Provide the repo (owner/name), file path, and optional branch ref. " +
    "Returns the file content (decoded from base64), size, SHA, and a direct link to the file on GitHub. " +
    "Results are cached for 5 minutes to avoid rate limits. " +
    "Examples: " +
    "repo: 'abhiswami2121/neptune-chat', path: 'README.md', ref: 'main' — " +
    "repo: 'abhiswami2121/neptune-v2', path: 'lib/session.ts'.",

  inputSchema: z.object({
    repo: z
      .string()
      .describe(
        "Full repository name (owner/name). Examples: 'abhiswami2121/neptune-chat', 'abhiswami2121/neptune-v2'"
      ),
    path: z
      .string()
      .describe(
        "File path within the repository. Examples: 'README.md', 'lib/agent/inline-tools.ts', 'app/layout.tsx'"
      ),
    ref: z
      .string()
      .optional()
      .default("main")
      .describe(
        "Branch name, tag, or commit SHA. Defaults to 'main'. Example: 'feat/my-branch'"
      ),
  }),

  execute: async ({ repo, path: filePath, ref }) => {
    const key = cacheKey(repo, filePath, ref);

    // Check cache
    const cached = getCached(key);
    if (cached) {
      return { ...cached, cached: true };
    }

    try {
      // Validate GITHUB_TOKEN
      if (!GITHUB_TOKEN) {
        return {
          error: "GITHUB_TOKEN not configured. GitHub file reading is unavailable.",
          repo,
          path: filePath,
          ref,
        } satisfies ViewFileError;
      }

      // Call GitHub Contents API
      // GET /repos/{owner}/{repo}/contents/{path}?ref={ref}
      const encodedPath = encodeURIComponent(filePath);
      const apiPath = `/repos/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`;
      const data = (await ghApi(apiPath)) as {
        content?: string;
        size?: number;
        sha?: string;
        encoding?: string;
        html_url?: string;
        message?: string;
      };

      // Handle GitHub error response (e.g., file not found)
      if (data.message) {
        const errorResult: ViewFileError = {
          error: data.message,
          repo,
          path: filePath,
          ref,
        };
        return errorResult;
      }

      // Decode base64 content if present
      let decodedContent = "";
      if (data.content && data.encoding === "base64") {
        decodedContent = Buffer.from(data.content, "base64").toString("utf-8");
      } else if (data.content) {
        decodedContent = data.content;
      }

      const result: ViewFileResult = {
        content: decodedContent,
        size: data.size ?? decodedContent.length,
        sha: data.sha ?? "",
        encoding: data.encoding ?? "utf-8",
        html_url: data.html_url ?? `https://github.com/${repo}/blob/${ref}/${filePath}`,
        path: filePath,
        repo,
        ref,
        cached: false,
      };

      // Store in cache
      setCache(key, result);

      return result;
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      const errorResult: ViewFileError = {
        error: error.message || "Unknown error reading file from GitHub",
        repo,
        path: filePath,
        ref,
        status: error.status,
      };
      return errorResult;
    }
  },
});
