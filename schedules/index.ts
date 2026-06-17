/**
 * schedules/index.ts — Schedule Barrel Export (Eve Pattern 3)
 *
 * All Eve-pattern schedules in one place.
 * Non-breaking — existing cron jobs continue to work.
 *
 * Pattern 3: Schedules/ directory
 * Phase 38: Autonomous Coding Platform
 */

export { v2HealthSchedule } from "./v2-health";
export { driftDetectionSchedule } from "./drift-detection";

// ─── All Schedules ────────────────────────────────────────────────────────────

export { kgReindexSchedule } from "./knowledge-graph-reindex";

export const ALL_SCHEDULES = [
  { name: "v2-health", schedule: "0 */12 * * *", handler: "v2HealthSchedule" },
  { name: "drift-detection", schedule: "0 3 * * *", handler: "driftDetectionSchedule" },
  { name: "knowledge-graph-reindex", schedule: "0 4 * * 0", handler: "kgReindexSchedule" },
] as const;
