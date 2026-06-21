/**
 * lib/agent-session-bridge.ts — V2 ↔ VPS Unified Bridge
 *
 * Routes session creation and event streaming across both lanes:
 *   - V2 lane: POST to Neptune V2 agent-sessions API, SSE from /api/v2-bridge/stream
 *   - VPS lane: POST to hermes-vps dispatch, poll-based progress, Slack thread bridge
 *
 * Events from both lanes are normalized into the unified SSE format
 * consumed by AgentSessionCard.
 *
 * Part of M-N-META PRD Quality + Beautiful Handoff (2026-06-21)
 */

import { createSession, updateSession } from "./agent-session-store";
import { emitSessionEvent } from "./agent-sse-manager";
import type { SSEMessage, SSEEventType } from "./agent-sse-manager";
import { dispatchToVps, isQuickFix } from "@/playbook-skills/connectors/hermes-vps/actions";
import type { AgentSessionInsert } from "./agent-session-store";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SessionCreateInput {
  goal: string;
  context?: string;
  lane?: "v2" | "vps" | "auto";
  repo?: string;
  mode?: "investigation" | "modify_existing" | "new_project";
  chatId?: string;
  userEmail?: string;
  parentSessionId?: string;
  conversationId?: string;
}

export interface SessionCreateResult {
  success: boolean;
  sessionId: string;
  lane: "v2" | "vps";
  status: string;
  streamUrl?: string;
  v2Url?: string;
  dispatchId?: string;
  error?: string;
}

// ── Lane Detection ─────────────────────────────────────────────────────────

/**
 * Auto-detect the appropriate lane if not explicitly specified.
 * V2 for multi-file/long tasks, VPS for quick fixes.
 */
export function detectLane(input: SessionCreateInput): "v2" | "vps" {
  if (input.lane === "v2") return "v2";
  if (input.lane === "vps") return "vps";

  // Auto-detect
  const text = `${input.goal} ${input.context ?? ""}`;

  if (isQuickFix(text)) return "vps";

  // Default to V2 for complex coding tasks
  if (
    input.mode === "new_project" ||
    input.mode === "modify_existing" ||
    text.length > 500
  ) {
    return "v2";
  }

  return "vps";
}

// ── Session Creation ───────────────────────────────────────────────────────

const NEPTUNE_V2_API_BASE =
  process.env.NEPTUNE_V2_API_BASE || "https://neptune-v2.vercel.app";
const NEPTUNE_INTERNAL_TOKEN =
  process.env.NEPTUNE_INTERNAL_TOKEN || "";

export async function createAgentSession(
  input: SessionCreateInput
): Promise<SessionCreateResult> {
  const lane = detectLane(input);
  const sessionId = `as-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  console.log(
    `[agent-session-bridge] Creating session ${sessionId} on lane=${lane}`
  );

  // Persist initial session record
  const sessionData: AgentSessionInsert = {
    sessionId,
    goal: input.goal,
    mode: input.mode,
    repoName: input.repo,
    status: "routing",
    lane,
    chatId: input.chatId,
    userEmail: input.userEmail,
    parentSessionId: input.parentSessionId,
    conversationId: input.conversationId,
    runtime: lane === "v2" ? "opus_4_6" : "claude_sdk",
    model: lane === "v2" ? "claude-sonnet-4-20250514" : "claude-sdk",
    cardState: "inline",
    pocockPhase: null,
  };

  await createSession(sessionData);

  // Emit creation event
  await emitSessionEvent(sessionId, "session:created", {
    goal: input.goal,
    lane,
    mode: input.mode,
  });

  // Route to lane
  if (lane === "v2") {
    return createV2Session(sessionId, input);
  } else {
    return createVpsSession(sessionId, input);
  }
}

// ── V2 Lane ────────────────────────────────────────────────────────────────

async function createV2Session(
  sessionId: string,
  input: SessionCreateInput
): Promise<SessionCreateResult> {
  try {
    const res = await fetch(
      `${NEPTUNE_V2_API_BASE}/api/agent-sessions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${NEPTUNE_INTERNAL_TOKEN}`,
        },
        body: JSON.stringify({
          sessionId,
          goal: input.goal,
          mode: input.mode || "modify_existing",
          context: input.context,
          repo: input.repo,
          chatId: input.chatId,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`V2 API returned ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();

    await updateSession(sessionId, {
      status: "spawning",
      v2DirectUrl: `https://neptune-v2.vercel.app/agent-sessions/${sessionId}`,
    });

    await emitSessionEvent(sessionId, "lane:assigned", {
      lane: "v2",
      v2SessionId: data.sessionId || sessionId,
    });

    return {
      success: true,
      sessionId,
      lane: "v2",
      status: "spawning",
      streamUrl: `/api/agent-sessions/${sessionId}/sse`,
      v2Url: `https://neptune-v2.vercel.app/agent-sessions/${sessionId}`,
    };
  } catch (err) {
    console.error(`[agent-session-bridge] V2 session creation failed:`, err);

    await updateSession(sessionId, { status: "failed" });
    await emitSessionEvent(sessionId, "error", {
      message: (err as Error).message,
    });

    return {
      success: false,
      sessionId,
      lane: "v2",
      status: "failed",
      error: (err as Error).message,
    };
  }
}

// ── VPS Lane ───────────────────────────────────────────────────────────────

async function createVpsSession(
  sessionId: string,
  input: SessionCreateInput
): Promise<SessionCreateResult> {
  try {
    const prompt = input.goal;
    const context = input.context
      ? `${input.context}\n\n[Session: ${sessionId}]`
      : `[Session: ${sessionId}]`;

    const result = await dispatchToVps(prompt, context);

    if (!result.success) {
      throw new Error(result.error || "VPS dispatch failed");
    }

    await updateSession(sessionId, {
      status: "spawning",
    });

    await emitSessionEvent(sessionId, "lane:assigned", {
      lane: "vps",
      dispatchId: result.dispatchId,
    });

    // Start background polling that bridges to SSE
    startVpsPollBridge(sessionId, result.dispatchId!).catch((err) => {
      console.error(`[agent-session-bridge] VPS poll bridge error:`, err);
    });

    return {
      success: true,
      sessionId,
      lane: "vps",
      status: "spawning",
      dispatchId: result.dispatchId,
      streamUrl: `/api/agent-sessions/${sessionId}/sse`,
    };
  } catch (err) {
    console.error(`[agent-session-bridge] VPS session creation failed:`, err);

    await updateSession(sessionId, { status: "failed" });
    await emitSessionEvent(sessionId, "error", {
      message: (err as Error).message,
    });

    return {
      success: false,
      sessionId,
      lane: "vps",
      status: "failed",
      error: (err as Error).message,
    };
  }
}

// ── VPS Poll Bridge ────────────────────────────────────────────────────────

import { smartPollLoop, POLL_INTERVAL_MS } from "@/playbook-skills/connectors/hermes-vps/actions";

async function startVpsPollBridge(
  sessionId: string,
  dispatchId: string
): Promise<void> {
  let lastToolCalls = 0;

  await smartPollLoop({
    dispatchId,
    onProgress: async (pollResult) => {
      // Status updates
      if (pollResult.status) {
        await updateSession(sessionId, {
          status: pollResult.status === "completed"
            ? "complete"
            : pollResult.status === "failed"
            ? "failed"
            : pollResult.status === "cancelled"
            ? "failed"
            : pollResult.status,
          progress: pollResult.progress?.turnsUsed ?? 0,
        });

        await emitSessionEvent(sessionId, "status:change", {
          status: pollResult.status,
          turnsUsed: pollResult.progress?.turnsUsed ?? 0,
        });
      }

      // Tool call updates
      if (pollResult.progress?.toolCalls !== undefined) {
        const newCalls = pollResult.progress.toolCalls - lastToolCalls;
        if (newCalls > 0) {
          // Emit individual tool call events
          const recentCalls = pollResult.progress.recentToolCalls || [];
          const newest = recentCalls.slice(-newCalls);
          for (const tc of newest) {
            await emitSessionEvent(
              sessionId,
              tc.status === "complete"
                ? "tool:complete"
                : tc.status === "error"
                ? "tool:error"
                : "tool:start",
              {
                toolName: tc.toolName,
                status: tc.status,
                preview: tc.preview,
              }
            );
          }
        }
        lastToolCalls = pollResult.progress.toolCalls;
      }

      // Cost tracking (from turn count — actual cost from VPS when available)
      if (pollResult.progress?.turnsUsed) {
        await emitSessionEvent(sessionId, "cost:update", {
          turnsUsed: pollResult.progress.turnsUsed,
          maxTurns: pollResult.progress.maxTurns,
        });
      }
    },
    onComplete: async (result) => {
      await updateSession(sessionId, {
        status: "complete",
        completedAt: new Date(),
      });

      await emitSessionEvent(sessionId, "complete", {
        summary: result.result?.summary,
        turnsUsed: result.progress?.turnsUsed ?? 0,
        slackThreadTs: result.result?.slackThreadTs,
      });
    },
    onError: async (error) => {
      await updateSession(sessionId, { status: "failed" });
      await emitSessionEvent(sessionId, "error", { message: error });
    },
  });
}

/**
 * Subscribe to V2 SSE events and bridge them to our unified format.
 * Called by the agent-sessions/[id]/sse route for V2 sessions.
 */
export async function bridgeV2Stream(
  sessionId: string,
  v2StreamUrl: string,
  signal?: AbortSignal
): Promise<void> {
  try {
    const res = await fetch(v2StreamUrl, {
      headers: {
        Authorization: `Bearer ${NEPTUNE_INTERNAL_TOKEN}`,
        Accept: "text/event-stream",
      },
      signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`V2 stream returned ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const event = JSON.parse(line.slice(6));

            // Map V2 event types to our unified types
            const eventType = mapV2EventType(event.type);
            await emitSessionEvent(sessionId, eventType, event.data || event);

            // Update session status on terminal events
            if (eventType === "complete") {
              await updateSession(sessionId, {
                status: "complete",
                completedAt: new Date(),
                deployUrl: event.data?.deployUrl,
                prUrl: event.data?.prUrl,
              });
            } else if (eventType === "error") {
              await updateSession(sessionId, { status: "failed" });
            }
          } catch {
            // Skip unparseable events
          }
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      console.error(`[agent-session-bridge] V2 stream bridge error:`, err);
    }
  }
}

function mapV2EventType(v2Type: string): SSEEventType {
  const map: Record<string, SSEEventType> = {
    tool_use: "tool:start",
    tool_result: "tool:complete",
    code_change: "file:changed",
    build_start: "build:log",
    deploy_start: "deploy:status",
    pr_created: "pr:created",
    completion: "complete",
    session_complete: "complete",
    error: "error",
    status: "status:change",
    progress: "progress:update",
  };
  return map[v2Type] || "progress:update";
}
