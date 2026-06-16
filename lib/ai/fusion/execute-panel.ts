/**
 * Phase 23A: executePanel — Main entry point for Fusion panel execution.
 *
 * Flow:
 *   1. Determine mode (auto via task-analyzer OR user override)
 *   2. Route to council executor (Phase 23A only)
 *   3. Log telemetry via after() hook
 */

import { routeAndExecute } from "./mode-router";
import { logPanelRun } from "./telemetry";
import type { ExecutePanelOptions, PanelRun } from "./types";

export async function executePanel(options: ExecutePanelOptions) {
  const { preset, messages, onEvent, modeOverride, sessionId, userId } =
    options;

  // Run the actual execution
  const result = await routeAndExecute({
    preset,
    messages,
    onEvent,
    modeOverride,
  });

  // Log telemetry (non-blocking — don't await if not needed)
  const telemetryPromise = logPanelRun({
    presetId: preset.id,
    presetName: preset.name,
    sessionId,
    userId,
    executionMode: result.mode as PanelRun["executionMode"],
    modeDecision:
      modeOverride && modeOverride !== "auto" ? "user-forced" : "auto",
    modeOverride:
      modeOverride && modeOverride !== "auto" ? modeOverride : undefined,
    taskAnalysis: result.taskAnalysis,
    agentResponses: result.agentResponses,
    judgeResponse: result.judgeResponse,
    totalCost: result.totalCost,
    totalLatency: result.totalLatency,
    totalTokensIn: result.totalTokensIn,
    totalTokensOut: result.totalTokensOut,
    status: result.judgeResponse ? "completed" : "failed",
  });

  // Don't block the response on telemetry — fire and forget
  telemetryPromise.catch((err) => {
    console.warn(
      "[fusion] Telemetry log failed (non-fatal):",
      (err as Error).message
    );
  });

  return result;
}
