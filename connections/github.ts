/**
 * connections/github.ts — GitHub Connection (Eve Pattern Adapter)
 *
 * Adopts Eve's defineMcpClientConnection pattern for GitHub.
 * Uses Vercel Connect OAuth for token management when available,
 * falls back to environment variable for VPS operations.
 *
 * Pattern 1: Connections/ + Vercel Connect OAuth
 * Phase 38: Autonomous Coding Platform
 */

// ─── Types (Eve-compatible shape) ─────────────────────────────────────────────

export interface ConnectionAuth {
  provider: "vercel-connect" | "env" | "manual";
  clientId?: string;
  scopes?: string[];
  tokenEnv?: string;
}

export interface McpClientConnection {
  name: string;
  description: string;
  url: string;
  auth: ConnectionAuth;
  transport: "stdio" | "sse" | "http";
  headers?: Record<string, string>;
}

// ─── GitHub Connection ────────────────────────────────────────────────────────

/**
 * GitHub MCP connection via Vercel Connect OAuth.
 *
 * When Vercel Connect is available (Vercel deploy), OAuth handles token lifecycle.
 * On VPS, falls back to GITHUB_TOKEN environment variable.
 */
export const githubConnection: McpClientConnection = {
  name: "github",
  description: "GitHub API — repository management, PRs, issues, code search",
  url: "https://api.github.com",
  auth: {
    provider: process.env.VERCEL_ENV ? "vercel-connect" : "env",
    scopes: ["repo", "workflow", "read:org"],
    tokenEnv: "GITHUB_TOKEN",
  },
  transport: "http",
  headers: {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "Neptune-Agent/5.0",
  },
};

/**
 * Resolves the GitHub auth token dynamically.
 * Priorities: Vercel Connect session → GITHUB_TOKEN env → error
 */
export async function resolveGitHubToken(): Promise<string> {
  // 1. Try Vercel Connect if in Vercel environment
  if (process.env.VERCEL_ENV) {
    try {
      // Vercel Connect resolves OAuth tokens via the platform
      const token = process.env.VERCEL_GITHUB_TOKEN;
      if (token) return token;
    } catch {
      // Fall through to env var
    }
  }

  // 2. Fall back to environment variable
  const envToken = process.env.GITHUB_TOKEN;
  if (envToken) return envToken;

  throw new Error("No GitHub token available. Set GITHUB_TOKEN or deploy on Vercel.");
}

/**
 * Eve-compatible connection export.
 * In a full Eve adoption, this would use defineMcpClientConnection().
 */
export default githubConnection;
