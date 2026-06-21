/**
 * lib/self-coding/sse-events.ts — SSE Event Type Definitions
 *
 * M-N-SELF-CODING (2026-06-21): Standardized SSE event types for the
 * self-coding lane. These events are streamed to the AgentSessionCard
 * component via /api/agent-sessions/[id]/sse.
 *
 * 6 new event types:
 *   self-code:plan-generated   — Task analysis complete, plan ready
 *   self-code:applying-diff     — File diff being applied to branch
 *   self-code:tests-running      — Tests executing (if any)
 *   self-code:pr-opened         — PR created on GitHub
 *   self-code:deploy-started    — Vercel deploy triggered
 *   self-code:deploy-complete   — Vercel deploy finished (READY or ERROR)
 */

// ── Event Payload Types ────────────────────────────────────────────────────

export interface PlanGeneratedPayload {
  /** Summary of the plan */
  summary: string;
  /** Number of files to be changed */
  fileCount: number;
  /** Files that will be created/modified/deleted */
  files: Array<{ path: string; operation: "create" | "update" | "delete" }>;
  /** Estimated complexity */
  complexity: "trivial" | "simple" | "moderate" | "complex";
}

export interface ApplyingDiffPayload {
  /** File path being modified */
  path: string;
  /** Operation type */
  operation: "create" | "update" | "delete";
  /** Progress: current file index (1-based) */
  current: number;
  /** Total files to apply */
  total: number;
  /** Diff preview (first 500 chars) */
  preview?: string;
}

export interface TestsRunningPayload {
  /** Test runner being used */
  runner: string;
  /** Total test count */
  totalTests: number;
  /** Passed so far */
  passed: number;
  /** Failed so far */
  failed: number;
}

export interface PrOpenedPayload {
  /** PR number */
  number: number;
  /** PR URL on GitHub */
  url: string;
  /** Branch name */
  branch: string;
  /** Base branch */
  base: string;
  /** PR title */
  title: string;
}

export interface DeployStartedPayload {
  /** Vercel deployment ID */
  deploymentId: string;
  /** Vercel project */
  project: string;
  /** Target branch */
  branch?: string;
}

export interface DeployCompletePayload {
  /** Vercel deployment ID */
  deploymentId: string;
  /** Live deployment URL */
  url: string;
  /** Inspector URL */
  inspectorUrl?: string;
  /** Deploy state */
  state: "READY" | "ERROR";
  /** Build time in ms */
  buildTimeMs?: number;
  /** Error message if state is ERROR */
  error?: string;
}

// ── Event Map ─────────────────────────────────────────────────────────────

/** All self-code SSE event types and their payloads */
export interface SelfCodeEventMap {
  "self-code:plan-generated": PlanGeneratedPayload;
  "self-code:applying-diff": ApplyingDiffPayload;
  "self-code:tests-running": TestsRunningPayload;
  "self-code:pr-opened": PrOpenedPayload;
  "self-code:deploy-started": DeployStartedPayload;
  "self-code:deploy-complete": DeployCompletePayload;
}

export type SelfCodeEventType = keyof SelfCodeEventMap;

// ── SSE Formatter ─────────────────────────────────────────────────────────

/**
 * Format a self-code event for SSE transmission.
 *
 * Usage:
 *   const sse = formatSelfCodeSse("self-code:pr-opened", {
 *     number: 15,
 *     url: "https://github.com/abhiswami2121/neptune-chat/pull/15",
 *     branch: "feat/self-code-fix-button-123456",
 *     base: "main",
 *     title: "feat(self-code): Fix button alignment"
 *   });
 *   res.write(sse);
 */
export function formatSelfCodeSse<T extends SelfCodeEventType>(
  type: T,
  payload: SelfCodeEventMap[T]
): string {
  return `event: ${type}\ndata: ${JSON.stringify({
    type,
    timestamp: new Date().toISOString(),
    ...payload,
  })}\n\n`;
}

/**
 * All 6 self-code event type names (for iteration/validation).
 */
export const SELF_CODE_EVENT_TYPES: SelfCodeEventType[] = [
  "self-code:plan-generated",
  "self-code:applying-diff",
  "self-code:tests-running",
  "self-code:pr-opened",
  "self-code:deploy-started",
  "self-code:deploy-complete",
];

/**
 * Check if an event type string is a valid self-code event type.
 */
export function isSelfCodeEventType(type: string): type is SelfCodeEventType {
  return SELF_CODE_EVENT_TYPES.includes(type as SelfCodeEventType);
}
