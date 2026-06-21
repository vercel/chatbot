/**
 * lib/chat/router.ts — Phase 38.5 Wiring Fix (2026-06-17)
 * Extended: M-N-SELF-CODING 3-Lane Routing (2026-06-21)
 *
 * Chat routing entry point. Bridges the intent classifier with the Phase 38
 * Discovery Engine AND the 3-lane coding dispatch (V2/VPS/SELF).
 * Called BEFORE LLM dispatch in app/(chat)/api/chat/route.ts.
 *
 * Flow:
 *   classifyMessage(text) → isBulkIntent?
 *     → YES: dispatchToDiscovery(workflowId, config) → SSE response
 *     → NO:  checkCodingIntent?
 *       → YES: routeCodingTask(text) → V2/VPS/SELF lane
 *     → NO:  return null → route.ts continues to normal LLM flow
 *
 * 3-Lane Coding Routing (M-N-SELF-CODING):
 *   1. Long/complex tasks → V2 (neptune-v2 sandboxed coding agent)
 *   2. Quick fixes → VPS (Base44 hybridDispatch, ephemeral)
 *   3. Fallback → SELF (direct GitHub + Vercel, no handoff)
 */

import {
  classifyIntentSync,
  type ClassificationResult,
} from "@/lib/chat/intent-classifier";

export type { ClassificationResult };

// ── Self-coding lane types (M-N-SELF-CODING) ───────────────────────────

import type { CodingLane, LaneHealth, RoutingDecision } from "@/lib/self-coding/workflow";

// ── Router Result Types ─────────────────────────────────────────────────

export interface DiscoveryRoute {
  /** Always true when routed to discovery */
  discoveryRouted: true;
  /** The matched workflow ID */
  workflowId: string;
  /** Classification confidence (0.0–1.0) */
  confidence: number;
  /** Extracted configuration (daysBack, channels, customerHint, etc.) */
  config: Record<string, unknown>;
  /** Human-readable reasoning for UI display */
  reasoning: string;
  /** SSE URL for frontend to subscribe to progress */
  sseUrl: string;
  /** Run ID returned by discovery engine */
  runId: string;
}

export interface NoRoute {
  discoveryRouted: false;
  /** Classification result for telemetry/debugging */
  classification: ClassificationResult | null;
}

export type RouteResult = DiscoveryRoute | NoRoute;

// ── Configuration ───────────────────────────────────────────────────────

const DISCOVERY_API_TIMEOUT_MS = 10_000;
const DISCOVERY_ROUTING_ENABLED =
  process.env.FEATURE_DISCOVERY_ROUTING !== "false";

/**
 * Classify a user message and determine if it should route to discovery.
 * Returns a DiscoveryRoute if the message is a bulk/discovery intent,
 * or a NoRoute if it should continue to normal LLM flow.
 *
 * @param messageText - The user's message text
 * @returns RouteResult — check discoveryRouted to branch
 */
export function classifyMessage(messageText: string): RouteResult {
  if (!DISCOVERY_ROUTING_ENABLED) {
    return {
      discoveryRouted: false,
      classification: null,
    };
  }

  const classification = classifyIntentSync(messageText);

  if (!classification.isBulkIntent || !classification.workflowId) {
    return {
      discoveryRouted: false,
      classification,
    };
  }

  // M-N-META: PRD intent → inject Pocock skills (different route)
  if (classification.workflowId === "prd-generation") {
    const sseUrl = `/api/agent-sessions/sse?workflowId=${encodeURIComponent("prd-generation")}`;
    return {
      discoveryRouted: true,
      workflowId: classification.workflowId,
      confidence: classification.confidence,
      config: {
        ...classification.extractedConfig,
        // Auto-inject Pocock engineering skills
        injectedSkills: [
          "pocock-engineering/grill",
          "pocock-engineering/to-prd",
          "pocock-engineering/grill-with-docs",
          "pocock-engineering/improve-codebase-architecture",
        ],
        discoveryPreamble: true, // Signal to include discovery preamble
        pocockPhase: "grill",    // Start with grill phase
      } as Record<string, unknown>,
      reasoning: `${classification.reasoning} [Pocock 7-phase discipline injected]`,
      sseUrl,
      runId: "",
    };
  }

  // Build the SSE URL (runId assigned by discovery engine on dispatch)
  const sseUrl = `/api/discovery/sse?workflowId=${encodeURIComponent(classification.workflowId)}`;

  return {
    discoveryRouted: true,
    workflowId: classification.workflowId,
    confidence: classification.confidence,
    config: classification.extractedConfig as Record<string, unknown>,
    reasoning: classification.reasoning,
    sseUrl,
    runId: "", // Assigned by dispatchToDiscovery
  };
}

// ── Discovery Dispatch ──────────────────────────────────────────────────

export interface DispatchResult {
  success: boolean;
  runId?: string;
  workflowName?: string;
  estimatedDuration?: string;
  sseUrl?: string;
  error?: string;
}

/**
 * Trigger the Phase 38 Discovery Engine for a classified workflow.
 * Calls POST /api/discovery/run and returns the run metadata.
 *
 * @param workflowId - The discovery workflow template ID
 * @param config - Configuration overrides from the classifier
 * @returns DispatchResult with runId and SSE URL on success
 */
export async function dispatchToDiscovery(
  workflowId: string,
  config: Record<string, unknown> = {}
): Promise<DispatchResult> {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    DISCOVERY_API_TIMEOUT_MS
  );

  try {
    const res = await fetch(`${baseUrl}/api/discovery/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId, config }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        success: false,
        error: `Discovery API returned ${res.status}: ${body.slice(0, 300)}`,
      };
    }

    const data = await res.json();

    return {
      success: true,
      runId: data.runId,
      workflowName: data.workflowName,
      estimatedDuration: data.estimatedDuration,
      sseUrl: `/api/discovery/sse?runId=${encodeURIComponent(data.runId)}`,
    };
  } catch (err) {
    clearTimeout(timeout);
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Discovery engine unreachable",
    };
  }
}

export default classifyMessage;

// ── M-N-SELF-CODING: 3-Lane Coding Router (2026-06-21) ──────────────────

export type { CodingLane, LaneHealth, RoutingDecision };

/**
 * Coding intent keywords that indicate a user message should be routed
 * through the 3-lane coding system rather than normal LLM flow.
 */
const CODING_INTENT_KEYWORDS = [
  "create file",
  "create a file",
  "add a file",
  "write code",
  "implement",
  "refactor",
  "fix the",
  "fix this",
  "debug",
  "build a",
  "scaffold",
  "add endpoint",
  "create component",
  "modify",
  "update the code",
  "change the code",
  "push code",
  "deploy",
  "open PR",
  "open a PR",
  "merge",
  "commit",
] as const;

/**
 * Check if a user message contains coding intent keywords.
 * Used by the chat route to decide whether to route through coding lanes.
 */
export function isCodingIntent(message: string): boolean {
  if (!message || message.length < 10) return false;
  const lower = message.toLowerCase();

  for (const kw of CODING_INTENT_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }

  return false;
}

/**
 * Coding task routing result — what the chat route should do.
 */
export interface CodingRoute {
  codingRouted: true;
  lane: CodingLane;
  reason: string;
  recommendation: "handoff_to_v2" | "dispatch_to_vps" | "apply_directly";
  sseEventType: string;
  handoffUrl?: string;
  dispatchId?: string;
  fallbackChain: string[];
}

export interface CodingNoRoute {
  codingRouted: false;
}

export type CodingRouteResult = CodingRoute | CodingNoRoute;

/**
 * Route a coding task through the 3-lane system.
 *
 * Priority:
 *   1. Long task / refactor / multi-file  → V2 (recommend handoff)
 *   2. Quick fix (short, single action)   → VPS (recommend dispatch)
 *   3. Fallback / explicit self-code      → SELF (recommend apply_directly)
 *
 * This is a synchronous classification — actual health checking and
 * handoff execution happen asynchronously so the chat route can respond quickly.
 */
export function routeCodingTask(message: string): CodingRouteResult {
  const lower = message.toLowerCase();
  const len = message.length;

  // ── Self-code explicit keywords ──
  const selfKeywords = [
    "do it yourself",
    "code it yourself",
    "apply directly",
    "don't hand off",
    "don't handoff",
    "self code",
    "self-code",
  ];
  const isExplicitSelf = selfKeywords.some((kw) => lower.includes(kw));

  if (isExplicitSelf) {
    return {
      codingRouted: true,
      lane: "self",
      reason: "User explicitly requested self-coding",
      recommendation: "apply_directly",
      sseEventType: "self-code:plan-generated",
      fallbackChain: ["self"],
    };
  }

  // ── Long/complex task → V2 ──
  const longKeywords = [
    "refactor",
    "multi-file",
    "multi file",
    "scaffold",
    "bootstrap",
    "migration",
    "rewrite",
    "architecture",
    "restructure",
    "new feature",
    "build a new",
    "implement a new",
  ];
  const isLongTask = len > 500 || longKeywords.some((kw) => lower.includes(kw));

  if (isLongTask) {
    return {
      codingRouted: true,
      lane: "v2",
      reason: "Long/complex task — routing to V2 sandboxed agent",
      recommendation: "handoff_to_v2",
      sseEventType: "lane:assigned",
      fallbackChain: ["v2", "vps", "self"],
    };
  }

  // ── Quick fix → VPS ──
  const quickKeywords = [
    "fix",
    "check",
    "run",
    "query",
    "look up",
    "find",
    "analyze",
    "debug",
    "inspect",
    "show",
    "get",
  ];
  const isQuick = len < 300 || quickKeywords.some((kw) => lower.includes(kw));

  if (isQuick) {
    return {
      codingRouted: true,
      lane: "vps",
      reason: "Quick fix — routing to VPS ephemeral dispatch",
      recommendation: "dispatch_to_vps",
      sseEventType: "lane:assigned",
      fallbackChain: ["vps", "self"],
    };
  }

  // ── Default: moderate → VPS with self-code fallback ──
  return {
    codingRouted: true,
    lane: "vps",
    reason: "Moderate task — VPS dispatch with self-code fallback",
    recommendation: "dispatch_to_vps",
    sseEventType: "lane:assigned",
    fallbackChain: ["vps", "self"],
  };
}

/**
 * Classify user message — first try discovery, then coding.
 * Returns the first matching route, or NoRoute if neither matches.
 */
export function classifyAndRoute(message: string): RouteResult | CodingRouteResult {
  // Try discovery first
  const discoveryRoute = classifyMessage(message);
  if (discoveryRoute.discoveryRouted) return discoveryRoute;

  // Try coding route
  if (isCodingIntent(message)) return routeCodingTask(message);

  // Neither matched — normal LLM flow
  return { discoveryRouted: false, classification: null };
}
