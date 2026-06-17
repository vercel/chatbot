/**
 * connections/index.ts — Connection Barrel Export
 *
 * All Eve-pattern connections with Vercel Connect OAuth support.
 * Non-breaking adoption — existing connector-skills continue to work.
 *
 * Pattern 1: Connections/ + Vercel Connect OAuth
 * Phase 38: Autonomous Coding Platform
 */

export { githubConnection, resolveGitHubToken } from "./github";
export type { McpClientConnection, ConnectionAuth } from "./github";

export { linearConnection, resolveLinearToken } from "./linear";
export { nmiConnection, resolveNmiSecurityKey } from "./nmi";
