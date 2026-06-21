/**
 * lib/self-coding/workflow.ts — Self-Coding Orchestration Engine
 *
 * M-N-SELF-CODING (2026-06-21): 3-lane coding dispatch with automatic fallback.
 *
 * Architecture:
 *   User message → classifyTask() → determine lane
 *     ├─ long task / refactor / multi-file     → V2 (neptune-v2.vercel.app)
 *     ├─ quick fix (short, single-file)        → VPS (Base44 hybridDispatch)
 *     ├─ V2 broken / VPS down                   → SELF (direct GitHub + Vercel)
 *     └─ explicit "do it yourself"             → SELF (direct)
 *
 * The SELF lane uses the existing GitHub connector (POST /api/github/*) and
 * Vercel connector (POST /api/vercel/*) to apply code and deploy directly
 * from Neptune Chat without any external handoff.
 */

import { checkV2Health, handoffToNeptuneCode } from "@/lib/code-handoff-bridge";
import { dispatchToVps, isQuickFix } from "@/playbook-skills/connectors/hermes-vps/actions";
import { secrets } from "@/secrets";
import type { DispatchResult as VpsDispatchResult } from "@/playbook-skills/connectors/hermes-vps/actions";

// ── Types ──────────────────────────────────────────────────────────────────

/** Available coding lanes */
export type CodingLane = "v2" | "vps" | "self";

/** Task classification result */
export interface TaskClassification {
  /** The assigned lane */
  lane: CodingLane;
  /** Reason for lane selection (for UI display) */
  reason: string;
  /** Whether the user explicitly requested self-coding */
  explicitSelf: boolean;
  /** Task complexity heuristic */
  complexity: "trivial" | "simple" | "moderate" | "complex";
  /** Estimated number of files affected */
  estimatedFiles: number;
  /** Whether this is a multi-file change */
  isMultiFile: boolean;
  /** Whether this requires a new PR or branch */
  needsBranch: boolean;
}

/** Lane health check result */
export interface LaneHealth {
  v2: { reachable: boolean; latencyMs: number; error?: string };
  vps: { reachable: boolean; latencyMs: number; error?: string };
  self: { reachable: boolean; githubToken: boolean; vercelToken: boolean; error?: string };
  /** Recommended lane based on health */
  recommendedLane: CodingLane;
}

/** Self-coding session state */
export interface SelfCodingSession {
  sessionId: string;
  lane: CodingLane;
  goal: string;
  repo: string;
  branch?: string;
  prNumber?: number;
  prUrl?: string;
  deployId?: string;
  deployUrl?: string;
  status: "planning" | "coding" | "testing" | "pr-open" | "deploying" | "complete" | "failed";
  startedAt: string;
}

/** Event emitted during self-coding workflow */
export interface SelfCodingEvent {
  type: SelfCodingEventType;
  sessionId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export type SelfCodingEventType =
  | "self-code:plan-generated"
  | "self-code:applying-diff"
  | "self-code:tests-running"
  | "self-code:pr-opened"
  | "self-code:deploy-started"
  | "self-code:deploy-complete";

/** Result of the routing decision */
export interface RoutingDecision {
  lane: CodingLane;
  reason: string;
  handoff: {
    sessionId?: string;
    streamUrl?: string;
    dispatchId?: string;
    directApply: boolean;
  };
  fallbackChain: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const V2_REPO = "abhiswami2121/neptune-chat";
const DEFAULT_REPO = "neptune-chat";

/** Keywords that indicate a long/complex task → route to V2 */
const LONG_TASK_KEYWORDS = [
  "refactor",
  "multi-file",
  "multi file",
  "scaffold",
  "bootstrap",
  "migration",
  "rewrite",
  "architecture",
  "restructure",
  "add new feature",
  "build a new",
  "implement a new",
  "create a new service",
  "add authentication",
  "add payment",
  "database schema",
];

/** Keywords where user explicitly wants self-coding */
const SELF_CODE_KEYWORDS = [
  "do it yourself",
  "do it yourselves",
  "code it yourself",
  "code it yourselves",
  "apply the code",
  "apply directly",
  "don't hand off",
  "don't handoff",
  "don't send to v2",
  "don't dispatch",
  "fix it yourself",
  "fix it here",
  "do it here",
  "self code",
  "self-code",
];

/** Minimum character length for a complex task */
const COMPLEX_TASK_MIN_LENGTH = 500;

/** Multi-file patterns in messages */
const MULTI_FILE_PATTERNS = [
  /\b(files?|components?|modules?|endpoints?|routes?)\s*[:\s]+\d+/i,
  /\b(across|spanning|touching)\s+\d+\s+files?\b/i,
  /\bmultiple\s+files?\b/i,
  /\.tsx?\s*,\s*\.tsx?\s*,\s*\.tsx?/,
];

// ── Task Classification ────────────────────────────────────────────────────

/**
 * Classify a coding task and determine the optimal lane.
 *
 * Priority:
 *   1. User explicitly says "do it yourself" → SELF
 *   2. Long/complex task → V2 (Neptune V2 sandboxed coding agent)
 *   3. Quick fix / short task → VPS (Base44 hybridDispatch)
 *   4. Explicit heuristic fallback → SELF
 */
export function classifyTask(message: string): TaskClassification {
  const lower = message.toLowerCase();
  const trimmed = message.trim();

  // ── Check explicit self-coding request ──
  const isExplicitSelf = SELF_CODE_KEYWORDS.some((kw) => lower.includes(kw));

  if (isExplicitSelf) {
    return {
      lane: "self",
      reason: "User explicitly requested self-coding",
      explicitSelf: true,
      complexity: estimateComplexity(trimmed),
      estimatedFiles: estimateFileCount(trimmed),
      isMultiFile: detectMultiFile(trimmed),
      needsBranch: true,
    };
  }

  // ── Check long/complex task → V2 ──
  const isLongTask = trimmed.length > COMPLEX_TASK_MIN_LENGTH ||
    LONG_TASK_KEYWORDS.some((kw) => lower.includes(kw));

  if (isLongTask) {
    return {
      lane: "v2",
      reason: "Long or complex task — routing to V2 sandboxed coding agent",
      explicitSelf: false,
      complexity: "complex",
      estimatedFiles: estimateFileCount(trimmed),
      isMultiFile: true,
      needsBranch: true,
    };
  }

  // ── Check quick fix → VPS ──
  if (isQuickFix(trimmed)) {
    return {
      lane: "vps",
      reason: "Quick fix detected — routing to VPS ephemeral dispatch",
      explicitSelf: false,
      complexity: "simple",
      estimatedFiles: 1,
      isMultiFile: false,
      needsBranch: false,
    };
  }

  // ── Default: moderate task → VPS with fallback ──
  return {
    lane: "vps",
    reason: "Moderate task — routing to VPS with self-code fallback",
    explicitSelf: false,
    complexity: "moderate",
    estimatedFiles: estimateFileCount(trimmed),
    isMultiFile: detectMultiFile(trimmed),
    needsBranch: false,
  };
}

/**
 * Estimate task complexity from message characteristics.
 */
function estimateComplexity(message: string): TaskClassification["complexity"] {
  const len = message.length;
  const codeBlocks = (message.match(/```/g) || []).length / 2;

  if (len < 150 && codeBlocks === 0) return "trivial";
  if (len < 400 && codeBlocks <= 1) return "simple";
  if (len < 1000 && codeBlocks <= 3) return "moderate";
  return "complex";
}

/**
 * Estimate how many files will be affected.
 */
function estimateFileCount(message: string): number {
  for (const pattern of MULTI_FILE_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 1) return num;
    }
  }

  // Count distinct file paths mentioned
  const filePaths = message.match(/[\w\/-]+\.(tsx?|jsx?|css|json|yaml|yml|md)/g);
  if (filePaths) {
    const unique = new Set(filePaths);
    return unique.size;
  }

  return 1;
}

/**
 * Detect if the task likely spans multiple files.
 */
function detectMultiFile(message: string): boolean {
  const lower = message.toLowerCase();

  for (const pattern of MULTI_FILE_PATTERNS) {
    if (pattern.test(lower)) return true;
  }

  // Check for multiple file mentions
  const fileCount = (message.match(/\.(tsx?|jsx?|css)\b/g) || []).length;
  return fileCount > 3;
}

// ── Lane Health Checking ───────────────────────────────────────────────────

/**
 * Check the health of all three coding lanes.
 * Used by the router to determine fallback order.
 */
export async function checkLaneHealth(): Promise<LaneHealth> {
  const results: LaneHealth = {
    v2: { reachable: false, latencyMs: 0 },
    vps: { reachable: false, latencyMs: 0 },
    self: { reachable: true, githubToken: !!secrets.github?.token, vercelToken: !!secrets.vercel?.token },
    recommendedLane: "self",
  };

  // ── V2 health ──
  const v2Start = Date.now();
  try {
    const v2Healthy = await checkV2Health();
    results.v2 = {
      reachable: v2Healthy,
      latencyMs: Date.now() - v2Start,
      error: v2Healthy ? undefined : "V2 health check failed",
    };
  } catch (err) {
    results.v2 = {
      reachable: false,
      latencyMs: Date.now() - v2Start,
      error: err instanceof Error ? err.message : "Unknown V2 error",
    };
  }

  // ── VPS health (lightweight — just check bridge reachability) ──
  const vpsStart = Date.now();
  try {
    const vpsDispatch = await dispatchToVps("ping", undefined);
    results.vps = {
      reachable: vpsDispatch.success,
      latencyMs: Date.now() - vpsStart,
      error: vpsDispatch.error,
    };
  } catch (err) {
    results.vps = {
      reachable: false,
      latencyMs: Date.now() - vpsStart,
      error: err instanceof Error ? err.message : "Unknown VPS error",
    };
  }

  // ── Determine recommended lane ──
  if (results.v2.reachable) {
    results.recommendedLane = "v2";
  } else if (results.vps.reachable) {
    results.recommendedLane = "vps";
  } else {
    results.recommendedLane = "self";
  }

  return results;
}

// ── Routing Decision Engine ────────────────────────────────────────────────

/**
 * Make a routing decision with health-aware fallback.
 *
 * Flow:
 *   classifyTask → check health → apply fallback if needed
 *
 * Fallback chain: V2 → VPS → SELF
 */
export async function routeTask(
  message: string,
  health: LaneHealth
): Promise<RoutingDecision> {
  const classification = classifyTask(message);
  const fallbackChain: string[] = [classification.lane];

  let finalLane: CodingLane = classification.lane;

  // ── Apply fallback chain ──
  if (finalLane === "v2" && !health.v2.reachable) {
    fallbackChain.push("vps");
    finalLane = "vps";
    console.log("[self-coding] V2 unreachable, falling back to VPS");
  }

  if (finalLane === "vps" && !health.vps.reachable) {
    fallbackChain.push("self");
    finalLane = "self";
    console.log("[self-coding] VPS unreachable, falling back to SELF");
  }

  if (finalLane === "self" && !health.self.githubToken) {
    console.warn("[self-coding] ⚠️ GitHub token missing — self-coding will fail");
  }

  // ── Build handoff instructions ──
  const handoff = {
    directApply: finalLane === "self",
    sessionId: undefined as string | undefined,
    streamUrl: undefined as string | undefined,
    dispatchId: undefined as string | undefined,
  };

  if (finalLane === "v2") {
    // Will be populated by actual handoff call
    handoff.directApply = false;
  } else if (finalLane === "vps") {
    // Will be populated by actual dispatch call
    handoff.directApply = false;
  }

  return {
    lane: finalLane,
    reason: finalLane !== classification.lane
      ? `${classification.reason} (fell back from ${classification.lane}: ${health[classification.lane].error})`
      : classification.reason,
    handoff,
    fallbackChain,
  };
}

/**
 * Full routing + dispatch flow.
 * Classifies, checks health, routes, and executes the handoff.
 *
 * @returns A RoutingDecision with populated handoff details.
 */
export async function routeAndDispatch(
  message: string,
  options?: {
    repo?: string;
    chatId?: string;
    userId?: string;
    sseCallback?: (event: SelfCodingEvent) => void;
  }
): Promise<RoutingDecision> {
  const health = await checkLaneHealth();
  const decision = await routeTask(message, health);

  const repo = options?.repo || DEFAULT_REPO;

  // ── Execute lane-specific dispatch ──
  if (decision.lane === "v2") {
    const handoffRes = await handoffToNeptuneCode({
      prompt: message,
      context: repo,
      chatId: options?.chatId,
      userId: options?.userId || "neptune-chat",
    });

    if (handoffRes.success && handoffRes.sessionId) {
      decision.handoff = {
        ...decision.handoff,
        sessionId: handoffRes.sessionId,
        streamUrl: handoffRes.sseUrl,
        directApply: false,
      };
    } else {
      // V2 handoff failed — try VPS fallback
      console.warn("[self-coding] V2 handoff failed:", handoffRes.error);
      decision.fallbackChain.push("vps");

      const vpsRes = await dispatchToVps(message, repo);
      if (vpsRes.success && vpsRes.dispatchId) {
        decision.handoff = {
          ...decision.handoff,
          dispatchId: vpsRes.dispatchId,
          directApply: false,
        };
        decision.lane = "vps";
      } else {
        // VPS also failed — use SELF
        decision.fallbackChain.push("self");
        decision.handoff = { directApply: true };
        decision.lane = "self";
      }
    }
  } else if (decision.lane === "vps") {
    const vpsRes = await dispatchToVps(message, repo);
    if (vpsRes.success && vpsRes.dispatchId) {
      decision.handoff = {
        ...decision.handoff,
        dispatchId: vpsRes.dispatchId,
        directApply: false,
      };
    } else {
      // VPS failed — use SELF
      decision.fallbackChain.push("self");
      decision.handoff = { directApply: true };
      decision.lane = "self";
    }
  }
  // For SELF lane, directApply is already true

  return decision;
}

// ── SSE Event Emitter ──────────────────────────────────────────────────────

/**
 * Create a standard self-coding event for SSE streaming.
 */
export function createSelfCodingEvent(
  type: SelfCodingEventType,
  sessionId: string,
  data: Record<string, unknown> = {}
): SelfCodingEvent {
  return {
    type,
    sessionId,
    timestamp: new Date().toISOString(),
    data,
  };
}

/**
 * Format a SelfCodingEvent for SSE transmission.
 */
export function formatSseEvent(event: SelfCodingEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
