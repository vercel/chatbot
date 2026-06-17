/**
 * connections/linear.ts — Linear Connection (Eve Pattern Adapter)
 *
 * Adopts Eve's defineMcpClientConnection pattern for Linear.
 * Uses Vercel Connect OAuth for token management.
 *
 * Pattern 1: Connections/ + Vercel Connect OAuth
 * Phase 38: Autonomous Coding Platform
 */

import type { McpClientConnection } from "./github";

// ─── Linear Connection ────────────────────────────────────────────────────────

/**
 * Linear MCP connection via Vercel Connect OAuth.
 *
 * Linear is primarily available via Vercel Connect OAuth.
 * Falls back to LINEAR_API_KEY env variable for VPS operations.
 */
export const linearConnection: McpClientConnection = {
  name: "linear",
  description: "Linear — project management, issues, sprints, roadmap",
  url: "https://mcp.linear.app/mcp",
  auth: {
    provider: process.env.VERCEL_ENV ? "vercel-connect" : "env",
    scopes: ["read", "write"],
    tokenEnv: "LINEAR_API_KEY",
  },
  transport: "http",
  headers: {
    "Content-Type": "application/json",
  },
};

/**
 * Resolves the Linear auth token dynamically.
 * Priorities: Vercel Connect session → LINEAR_API_KEY env → error
 */
export async function resolveLinearToken(): Promise<string> {
  if (process.env.VERCEL_ENV) {
    try {
      const token = process.env.VERCEL_LINEAR_TOKEN;
      if (token) return token;
    } catch {
      // Fall through
    }
  }

  const envToken = process.env.LINEAR_API_KEY;
  if (envToken) return envToken;

  throw new Error("No Linear token available. Set LINEAR_API_KEY or deploy on Vercel.");
}

export default linearConnection;
