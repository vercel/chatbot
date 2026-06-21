/**
 * Hermes VPS Actions — high-level dispatch/poll/cancel functions.
 *
 * These are the canonical entry points used by:
 *   1. The VpsDispatchModal (client-side, via API routes)
 *   2. The playbook router (server-side trigger word matching)
 *   3. The VpsProgressCard (poll loop every 10s)
 *
 * Each action returns a structured result with clear success/failure signals.
 *
 * @module hermes-vps/actions
 */

import { HermesVpsClient, getHermesVpsClient } from "./client";
import type {
  DispatchInput,
  DispatchResult,
  PollResult,
  CancelResult,
  HermesVpsClientConfig,
} from "./client";

// ── Re-export types ──────────────────────────────────────────────────────────

export type {
  DispatchInput,
  DispatchResult,
  PollResult,
  CancelResult,
  HermesVpsClientConfig,
};

// ── Constants ────────────────────────────────────────────────────────────────

/** Poll interval in ms (10 seconds per spec) */
export const POLL_INTERVAL_MS = 10_000;

/** Max poll attempts before giving up (60 * 10s = 10 minutes) */
export const MAX_POLL_ATTEMPTS = 60;

/** Slack channel for synthesis */
export const JARVIS_ADMIN_CHANNEL = "C0AQDDC3HAB";

// ── Action: Dispatch ─────────────────────────────────────────────────────────

/**
 * Dispatch a prompt to the VPS Claude SDK agent.
 *
 * @param prompt - The task prompt to send
 * @param context - Optional additional context
 * @param config - Optional client configuration overrides
 * @returns DispatchResult with dispatchId for polling
 */
export async function dispatchToVps(
  prompt: string,
  context?: string,
  config?: HermesVpsClientConfig
): Promise<DispatchResult> {
  const client = getHermesVpsClient(config);

  const input: DispatchInput = {
    prompt,
    context,
    tags: ["neptune-chat", "vps-dispatch", "hermes-vps"],
  };

  return client.dispatch(input);
}

// ── Action: Poll ─────────────────────────────────────────────────────────────

/**
 * Poll the status of a dispatched task.
 * Intended to be called every POLL_INTERVAL_MS (10s).
 *
 * @param dispatchId - The dispatch ID from dispatchToVps()
 * @param config - Optional client configuration overrides
 * @returns PollResult with current status, progress, and result
 */
export async function pollVpsDispatch(
  dispatchId: string,
  config?: HermesVpsClientConfig
): Promise<PollResult> {
  const client = getHermesVpsClient(config);
  return client.poll(dispatchId);
}

// ── Action: Cancel ───────────────────────────────────────────────────────────

/**
 * Cancel a running dispatch.
 *
 * @param dispatchId - The dispatch ID to cancel
 * @param config - Optional client configuration overrides
 * @returns CancelResult indicating success/failure
 */
export async function cancelVpsDispatch(
  dispatchId: string,
  config?: HermesVpsClientConfig
): Promise<CancelResult> {
  const client = getHermesVpsClient(config);
  return client.cancel(dispatchId);
}

// ── Action: Smart Poll Loop (with auto-stop) ─────────────────────────────────

export interface SmartPollOptions {
  dispatchId: string;
  onProgress?: (result: PollResult) => void;
  onComplete?: (result: PollResult) => void;
  onError?: (error: string) => void;
  signal?: AbortSignal;
  config?: HermesVpsClientConfig;
}

/**
 * Smart poll loop that automatically stops when the dispatch reaches
 * a terminal state (completed, failed, cancelled, lost).
 *
 * Emits progress updates via onProgress callback on each poll tick.
 * Respects AbortSignal for cancellation.
 *
 * @returns The final PollResult
 */
export async function smartPollLoop(
  options: SmartPollOptions
): Promise<PollResult> {
  const { dispatchId, onProgress, onComplete, onError, signal, config } = options;
  const client = getHermesVpsClient(config);

  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    // Check for abort signal
    if (signal?.aborted) {
      const cancelledResult: PollResult = {
        success: false,
        dispatchId,
        status: "cancelled",
        error: "Poll aborted by user",
      };
      onComplete?.(cancelledResult);
      return cancelledResult;
    }

    attempts++;

    const result = await client.poll(dispatchId);

    // Emit progress
    onProgress?.(result);

    // Terminal states
    if (result.status === "completed") {
      onComplete?.(result);
      return result;
    }

    if (result.status === "failed") {
      onError?.(result.error || "Dispatch failed");
      onComplete?.(result);
      return result;
    }

    if (result.status === "cancelled") {
      onComplete?.(result);
      return result;
    }

    if (result.status === "lost") {
      onError?.(result.error || "Dispatch lost — session expired on VPS");
      onComplete?.(result);
      return result;
    }

    // Status is "queued" or "running" — wait and poll again
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  // Max attempts reached
  const timeoutResult: PollResult = {
    success: false,
    dispatchId,
    status: "lost",
    error: `Poll timed out after ${MAX_POLL_ATTEMPTS} attempts (${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s)`,
  };
  onError?.(timeoutResult.error!);
  onComplete?.(timeoutResult);
  return timeoutResult;
}

// ── Action: Trigger Word Detection ───────────────────────────────────────────

/** All trigger words that activate the Hermes VPS connector */
export const TRIGGER_WORDS = [
  "send to vps",
  "dispatch to vps",
  "send prd to vps",
  "run on vps",
  "fix on vps",
  "quick fix vps",
  "vps please",
  "execute on vps",
  "send this task",
  "kick off mission",
] as const;

/**
 * Check if user input contains any Hermes VPS trigger word.
 * Case-insensitive match.
 *
 * @param input - User message text
 * @returns The matched trigger word, or null if no match
 */
export function detectVpsTrigger(input: string): string | null {
  if (!input) return null;
  const lower = input.toLowerCase();
  for (const trigger of TRIGGER_WORDS) {
    if (lower.includes(trigger.toLowerCase())) {
      return trigger;
    }
  }
  return null;
}

/**
 * Check if input is a "quick fix" style task (short, actionable)
 * vs a long coding task that should go to neptune-v2-handoff.
 *
 * Heuristic: tasks under 300 chars with action verbs are quick fixes.
 * Tasks over 500 chars or containing "refactor", "multi-file", "PR" etc
 * should be routed to neptune-v2-handoff instead.
 */
export function isQuickFix(input: string): boolean {
  if (!input) return false;

  const lower = input.toLowerCase();
  const longTaskKeywords = [
    "refactor",
    "multi-file",
    "multi file",
    "pull request",
    "create pr",
    "scaffold",
    "bootstrap",
    "migration",
    "rewrite",
  ];

  // If input is long or contains long-task keywords, route to V2
  if (input.length > 500) return false;
  for (const kw of longTaskKeywords) {
    if (lower.includes(kw)) return false;
  }

  // Check for quick-fix action verbs
  const quickFixVerbs = [
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
    "read",
    "what is",
    "how many",
    "why is",
  ];

  for (const verb of quickFixVerbs) {
    if (lower.includes(verb)) return true;
  }

  // Default: short messages are quick fixes
  return input.length < 300;
}

// ── Convenience: full dispatch flow ──────────────────────────────────────────

export interface QuickDispatchOptions {
  prompt: string;
  context?: string;
  onProgress?: (result: PollResult) => void;
  signal?: AbortSignal;
  config?: HermesVpsClientConfig;
}

/**
 * Full fire-and-track dispatch flow:
 *   1. dispatchToVps()
 *   2. smartPollLoop()
 *   3. Return final result
 *
 * This is the one-call entry point for programmatic use.
 * For UI, use dispatchToVps() + VpsProgressCard which handles polling itself.
 */
export async function quickDispatch(
  options: QuickDispatchOptions
): Promise<{ dispatch: DispatchResult; final: PollResult }> {
  const dispatch = await dispatchToVps(
    options.prompt,
    options.context,
    options.config
  );

  if (!dispatch.success || !dispatch.dispatchId) {
    return {
      dispatch,
      final: {
        success: false,
        dispatchId: dispatch.dispatchId || "unknown",
        status: "failed",
        error: dispatch.error || "Dispatch failed",
      },
    };
  }

  const final = await smartPollLoop({
    dispatchId: dispatch.dispatchId,
    onProgress: options.onProgress,
    signal: options.signal,
    config: options.config,
  });

  return { dispatch, final };
}
