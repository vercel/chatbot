/**
 * lib/chat/router.ts — Phase 38.5 Wiring Fix (2026-06-17)
 *
 * Chat routing entry point. Bridges the intent classifier with the Phase 38
 * Discovery Engine. Called BEFORE LLM dispatch in app/(chat)/api/chat/route.ts.
 *
 * Flow:
 *   classifyMessage(text) → isBulkIntent?
 *     → YES: dispatchToDiscovery(workflowId, config) → SSE response
 *     → NO:  return null → route.ts continues to normal LLM flow
 */

import {
  classifyIntentSync,
  type ClassificationResult,
} from "@/lib/chat/intent-classifier";

export type { ClassificationResult };

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
