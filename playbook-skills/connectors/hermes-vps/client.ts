/**
 * HermesVpsClient — wraps Base44 hybridDispatch for quick ephemeral VPS Claude SDK dispatch.
 *
 * Architecture:
 *   Client (browser) → /api/hermes-vps/*  (Next.js API routes)
 *                     → HermesVpsClient   (server-side, this file)
 *                       → VPS Bridge      (POST /tool/base44/invokeFunction)
 *                         → Base44 hybridDispatch → VPS Claude SDK agent
 *
 * Key difference from neptune-v2-handoff:
 *   - This is QUICK ephemeral dispatch (< 60 turns, no sandbox)
 *   - neptune-v2-handoff is LONG PR coding sessions (sandbox + SSE stream)
 *
 * Config:
 *   profile:  "deepseek-v4-pro" (default)
 *   runtime:  "claude_sdk"
 *   maxTurns: 60
 *
 * @module hermes-vps/client
 */

import { secrets } from "@/secrets";

// ── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_PROFILE = "deepseek-v4-pro";
const DEFAULT_RUNTIME = "claude_sdk";
const DEFAULT_MAX_TURNS = 60;

const VPS_BRIDGE_URL =
  secrets.vps.bridgeUrl || process.env.VPS_BRIDGE_URL || "http://localhost:8400";

const VPS_BRIDGE_TOKEN =
  secrets.vps.internalToken || process.env.NEPTUNE_INTERNAL_TOKEN || "";

const BASE44_FUNCTIONS_URL =
  secrets.base44.functionsUrl ||
  process.env.BASE44_FUNCTIONS_URL ||
  "https://api.base44.app/functions";

// ── Types ────────────────────────────────────────────────────────────────────

export interface HermesVpsClientConfig {
  profile?: string;
  runtime?: string;
  maxTurns?: number;
  bridgeUrl?: string;
  bridgeToken?: string;
  /** Slack channel for result synthesis */
  slackChannel?: string;
  /** Base44 internal token for function invocation */
  base44DiagKey?: string;
}

export interface DispatchInput {
  prompt: string;
  context?: string;
  /** Optional model override */
  model?: string;
  /** Tags for routing/filtering */
  tags?: string[];
  /** Slack thread_ts for posting updates */
  slackThreadTs?: string;
}

export interface DispatchResult {
  success: boolean;
  dispatchId?: string;
  status?: "dispatched" | "queued" | "rejected";
  pollUrl?: string;
  estimatedDurationMs?: number;
  error?: string;
}

export interface PollResult {
  success: boolean;
  dispatchId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "lost";
  progress?: {
    turnsUsed: number;
    maxTurns: number;
    currentStep?: string;
    toolCalls?: number;
  };
  result?: {
    summary: string;
    output?: string;
    artifacts?: string[];
    slackThreadTs?: string;
  };
  error?: string;
  elapsedMs?: number;
}

export interface CancelResult {
  success: boolean;
  dispatchId: string;
  message?: string;
  error?: string;
}

// ── Auth header builder ──────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (VPS_BRIDGE_TOKEN) {
    headers.Authorization = `Bearer ${VPS_BRIDGE_TOKEN}`;
  }
  return headers;
}

// ── VPS Bridge call ──────────────────────────────────────────────────────────

async function callVpsBridge(
  category: string,
  name: string,
  payload: Record<string, unknown>,
  timeoutMs = 30_000
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${VPS_BRIDGE_URL}/tool/${category}/${name}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        success: false,
        error: `VPS bridge returned ${res.status}: ${body.slice(0, 300)}`,
      };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: `VPS bridge unreachable: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ── Base44 function invocation ───────────────────────────────────────────────

async function callBase44Function(
  functionName: string,
  payload: Record<string, unknown>,
  timeoutMs = 60_000
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  // Primary: VPS bridge tool router (base44 category)
  const bridgeResult = await callVpsBridge(
    "base44",
    "invokeFunction",
    { functionName, payload },
    timeoutMs
  );

  if (bridgeResult.success) return bridgeResult;

  // Fallback: direct Base44 functions URL
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const base44Token = secrets.base44.apiKey || process.env.BASE44_API_KEY || "";
    const res = await fetch(`${BASE44_FUNCTIONS_URL}/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(base44Token ? { "x-api-key": base44Token } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        success: false,
        error: `Base44 direct returned ${res.status}: ${body.slice(0, 300)}`,
      };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: `Base44 direct unreachable: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ── HermesVpsClient ─────────────────────────────────────────────────────────

export class HermesVpsClient {
  private profile: string;
  private runtime: string;
  private maxTurns: number;
  private slackChannel: string;
  private base44DiagKey: string;

  constructor(config: HermesVpsClientConfig = {}) {
    this.profile = config.profile || DEFAULT_PROFILE;
    this.runtime = config.runtime || DEFAULT_RUNTIME;
    this.maxTurns = config.maxTurns || DEFAULT_MAX_TURNS;
    this.slackChannel = config.slackChannel || "jarvis-admin";
    this.base44DiagKey =
      config.base44DiagKey || secrets.vps.internalToken || "";
  }

  /**
   * Dispatch a task to the VPS Claude SDK agent via Base44 hybridDispatch.
   *
   * This is a FIRE-AND-FORGET operation. Use poll() to track progress.
   */
  async dispatch(input: DispatchInput): Promise<DispatchResult> {
    const payload = {
      profile: this.profile,
      runtime: this.runtime,
      maxTurns: this.maxTurns,
      prompt: input.prompt,
      context: input.context || "",
      model: input.model || this.profile,
      tags: input.tags || [],
      slackThreadTs: input.slackThreadTs || "",
      slackChannel: this.slackChannel,
      source: "neptune-chat-hermes-vps",
      timestamp: Date.now(),
    };

    const result = await callBase44Function("hybridDispatch", payload, 30_000);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const data = result.data as Record<string, unknown>;
    return {
      success: true,
      dispatchId: data.dispatchId as string,
      status: (data.status as DispatchResult["status"]) || "dispatched",
      pollUrl: data.pollUrl as string,
      estimatedDurationMs: data.estimatedDurationMs as number,
    };
  }

  /**
   * Poll the status of a running dispatch.
   * Client should call this every 10 seconds.
   */
  async poll(dispatchId: string): Promise<PollResult> {
    const result = await callBase44Function(
      "hybridDispatchPoll",
      { dispatchId },
      15_000
    );

    if (!result.success) {
      return {
        success: false,
        dispatchId,
        status: "lost",
        error: result.error,
      };
    }

    const data = result.data as Record<string, unknown>;
    return {
      success: true,
      dispatchId,
      status: (data.status as PollResult["status"]) || "lost",
      progress: data.progress
        ? (data.progress as PollResult["progress"])
        : undefined,
      result: data.result
        ? (data.result as PollResult["result"])
        : undefined,
      error: data.error as string,
      elapsedMs: data.elapsedMs as number,
    };
  }

  /**
   * Cancel a running dispatch.
   */
  async cancel(dispatchId: string): Promise<CancelResult> {
    const result = await callBase44Function(
      "hybridDispatchCancel",
      { dispatchId },
      15_000
    );

    if (!result.success) {
      return {
        success: false,
        dispatchId,
        error: result.error || "Cancel failed",
      };
    }

    const data = result.data as Record<string, unknown>;
    return {
      success: data.success !== false,
      dispatchId,
      message: data.message as string,
      error: data.error as string,
    };
  }

  /**
   * Health check — verify VPS bridge + Base44 are reachable.
   */
  async healthCheck(): Promise<{ ok: boolean; vpsBridge: boolean; base44: boolean }> {
    const vpsResult = await callVpsBridge("base44", "invokeFunction", { functionName: "ping", payload: {} }, 5_000);
    return {
      ok: vpsResult.success,
      vpsBridge: vpsResult.success,
      base44: vpsResult.success,
    };
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let _defaultClient: HermesVpsClient | null = null;

export function getHermesVpsClient(config?: HermesVpsClientConfig): HermesVpsClient {
  if (config) {
    return new HermesVpsClient(config);
  }
  if (!_defaultClient) {
    _defaultClient = new HermesVpsClient();
  }
  return _defaultClient;
}

export default HermesVpsClient;
