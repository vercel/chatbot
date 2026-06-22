/**
 * lib/agent-sse-utils.ts — Pure Client-Safe SSE Utilities
 *
 * Extracted from agent-sse-manager.ts to avoid pulling server-only
 * dependencies (postgres, drizzle) into client-side bundles.
 *
 * Part of M-NEPTUNE-FULL-ACCESS Phase 1: Vercel Deploy Fix (2026-06-22)
 */

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * Exponential backoff with jitter for SSE reconnection.
 * Starts at 1s, doubles each attempt, capped at 30s.
 * ±20% random jitter to avoid thundering herd.
 */
export function getBackoffDelay(attempt: number): number {
  const delay = Math.min(
    BASE_BACKOFF_MS * Math.pow(2, attempt),
    MAX_BACKOFF_MS
  );
  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}
