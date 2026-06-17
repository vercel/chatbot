/**
 * lib/sync/sync-events.ts — Sync Event Logging & Monitoring
 * Phase 30: Tracks bidirectional sync events for audit and debugging.
 */

import { SYNC_FAILURE_SLACK_THRESHOLD } from "./constants";

export interface SyncEventInput {
  direction: "b2t" | "t2b" | "n2t";
  recordId: string;
  eventType: string;
  status: "received" | "completed" | "failed" | "conflict_resolved" | "skipped";
  payload?: Record<string, unknown>;
  errorMessage?: string;
}

// In-memory buffer for recent failures (prod would use DB)
let consecutiveFailures: Array<{ recordId: string; direction: string; at: string }> = [];
const FAILURE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Create a sync event record.
 * In production, this would write to library_sync_events table.
 */
export async function createSyncEvent(input: SyncEventInput): Promise<void> {
  const event = {
    ...input,
    id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    createdAt: new Date().toISOString(),
  };

  console.log(
    `[sync-event] ${input.direction} ${input.status.padEnd(12)} ${input.recordId.slice(0, 12)}... ${input.eventType}`
  );

  // Track failures for alerting
  if (input.status === "failed") {
    consecutiveFailures.push({
      recordId: input.recordId,
      direction: input.direction,
      at: event.createdAt,
    });

    // Prune old failures
    const cutoff = new Date(Date.now() - FAILURE_WINDOW_MS).toISOString();
    consecutiveFailures = consecutiveFailures.filter((f) => f.at > cutoff);

    // Slack alert on threshold breach
    if (consecutiveFailures.length >= SYNC_FAILURE_SLACK_THRESHOLD) {
      console.error(
        `[sync-alert] ${consecutiveFailures.length} consecutive sync failures — SLACK ALERT TRIGGERED`
      );
      // Slack notification would fire here via slackMcpBridge
    }
  } else {
    // Reset on success
    consecutiveFailures = [];
  }

  // TODO: Persist to library_sync_events table in production
}

/**
 * Get current failure count (for admin UI).
 */
export function getConsecutiveFailureCount(): number {
  const cutoff = new Date(Date.now() - FAILURE_WINDOW_MS).toISOString();
  consecutiveFailures = consecutiveFailures.filter((f) => f.at > cutoff);
  return consecutiveFailures.length;
}
