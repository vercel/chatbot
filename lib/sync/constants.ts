/**
 * lib/sync/constants.ts — Sync Constants
 * Phase 30: Configuration constants for the sync engine.
 */

/** Number of consecutive failures before Slack alert */
export const SYNC_FAILURE_SLACK_THRESHOLD = 5;

/** Slack channel for sync alerts */
export const SYNC_ALERT_CHANNEL = "C0AQDDC3HAB"; // #jarvis-admin

/** Max retries for a failed sync event */
export const MAX_SYNC_RETRIES = 3;

/** Delay between retries (ms) */
export const SYNC_RETRY_DELAY_MS = 30_000;

/** Twenty API rate limit (requests per minute) */
export const TWENTY_RATE_LIMIT_RPM = 60;

/** Max batch size for Twenty GraphQL mutations */
export const TWENTY_BATCH_SIZE = 60;

/** Migration wave default size */
export const DEFAULT_WAVE_SIZE = 50;

/** Progress report interval (records) */
export const PROGRESS_REPORT_INTERVAL = 50;
