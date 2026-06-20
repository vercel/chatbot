/**
 * Phase 23B: V2 Handoff Client
 *
 * Client library for communicating with the V2 backend
 * (neptune-v2.vercel.app) for long-running coding agent sessions.
 *
 * V2 API (agent-sessions):
 *   POST   /api/agent-sessions          → create session
 *   GET    /api/agent-sessions/:id       → get status/details
 *   PATCH  /api/agent-sessions/:id       → update (stop/complete/error)
 *   GET    /api/agent-sessions/:id/stream → SSE event stream
 *
 * Auth: Bearer V2_AGENT_TOKEN (must match V2's NEPTUNE_INTERNAL_TOKEN).
 */

import { V2_BASE_URL, V2_AGENT_TOKEN } from "./types";
import type { V2HandoffEvent, V2SpawnRequest } from "./types";

export interface HandoffClientResult {
  success: boolean;
  sessionId?: string;
  streamUrl?: string;
  v2Url?: string;
  status?: string;
  error?: string;
  code?: string;
  suggestion?: string;
}

/**
 * Spawn a new coding agent session on V2 backend.
 * Calls POST /api/agent-sessions with mode="handoff".
 */
export async function spawnV2Session(
  request: V2SpawnRequest
): Promise<HandoffClientResult> {
  const { goal, mode, targetRepo, context } = request;

  if (!V2_AGENT_TOKEN) {
    return {
      success: false,
      code: "MISSING_V2_AGENT_TOKEN",
      error: "V2_AGENT_TOKEN not configured",
      suggestion:
        "Set V2_AGENT_TOKEN on chat AND ensure it matches NEPTUNE_INTERNAL_TOKEN on V2.",
    };
  }

  try {
    const res = await fetch(`${V2_BASE_URL}/api/agent-sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${V2_AGENT_TOKEN}`,
      },
      body: JSON.stringify({
        goal,
        mode: mode === "new_project" ? "sandbox" : mode === "investigation" ? "investigation" : "handoff",
        repo: targetRepo || null,
        chatId: (context as Record<string, unknown> | null)?.chatId || null,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      const isAuth = res.status === 401;
      // Stream A: Auth diagnostics (2026-06-20)
      const tokenSource = process.env.NEPTUNE_INTERNAL_TOKEN
        ? "NEPTUNE_INTERNAL_TOKEN"
        : process.env.V2_AGENT_TOKEN
          ? "V2_AGENT_TOKEN"
          : process.env.NEPTUNE_V2_HANDOFF_SECRET
            ? "NEPTUNE_V2_HANDOFF_SECRET"
            : "none (all empty)";
      const tokenPreview = V2_AGENT_TOKEN
        ? `${V2_AGENT_TOKEN.slice(0, 4)}...${V2_AGENT_TOKEN.slice(-4)}`
        : "(empty)";
      console.error(
        `[handoff-client] V2 returned ${res.status}. ` +
        `Token source: ${tokenSource}, preview: ${tokenPreview}. ` +
        `V2 expects: NEPTUNE_INTERNAL_TOKEN. Match? ${tokenSource === "NEPTUNE_INTERNAL_TOKEN" ? "YES (first chain)" : "CHECK — may mismatch"}`,
      );
      return {
        success: false,
        code: `V2_HTTP_${res.status}`,
        error: body.slice(0, 500),
        suggestion: isAuth
          ? `V2 rejected auth (token source: ${tokenSource}). Ensure this matches NEPTUNE_INTERNAL_TOKEN on V2.`
          : "Check V2 backend health at neptune-v2.vercel.app.",
      };
    }

    const data = await res.json();
    const sessionId = data.id || data.sessionId;
    return {
      success: true,
      sessionId,
      status: data.status || "started",
      streamUrl: `${V2_BASE_URL}/api/agent-sessions/${sessionId}/stream`,
      v2Url: `${V2_BASE_URL}/agent-sessions/${sessionId}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      code: "V2_UNREACHABLE",
      error: msg,
      suggestion: "V2 backend unreachable. Confirm neptune-v2.vercel.app is deployed.",
    };
  }
}

/**
 * Get status of a handoff session from V2.
 * Calls GET /api/agent-sessions/:id.
 */
export async function getV2SessionStatus(
  v2SessionId: string
): Promise<{ status: string; eventCount: number; error?: string; deployUrl?: string; prUrl?: string }> {
  try {
    const res = await fetch(
      `${V2_BASE_URL}/api/agent-sessions/${v2SessionId}`,
      {
        headers: { Authorization: `Bearer ${V2_AGENT_TOKEN}` },
      }
    );
    if (!res.ok) {
      return { status: "unknown", eventCount: 0, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return {
      status: data.status || "unknown",
      eventCount: data.eventCount ?? 0,
      deployUrl: data.deployUrl,
      prUrl: data.prUrl,
    };
  } catch (err) {
    return {
      status: "unknown",
      eventCount: 0,
      error: (err as Error).message,
    };
  }
}

/**
 * Stop a running V2 session.
 * Calls PATCH /api/agent-sessions/:id with status="aborted".
 */
export async function stopV2Session(
  v2SessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${V2_BASE_URL}/api/agent-sessions/${v2SessionId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${V2_AGENT_TOKEN}`,
        },
        body: JSON.stringify({ status: "aborted" }),
      }
    );
    return { success: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Read SSE stream from V2 session, yielding parsed events.
 * Calls GET /api/agent-sessions/:id/stream.
 */
export async function* streamV2Events(
  v2SessionId: string
): AsyncGenerator<V2HandoffEvent> {
  const streamUrl = `${V2_BASE_URL}/api/agent-sessions/${v2SessionId}/stream`;

  const res = await fetch(streamUrl, {
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${V2_AGENT_TOKEN}`,
    },
  });

  if (!res.ok || !res.body) {
    yield {
      type: "error",
      timestamp: new Date().toISOString(),
      data: { message: `V2 stream failed: ${res.status}` },
    };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const event: V2HandoffEvent = JSON.parse(line.slice(6));
            yield event;
          } catch {
            // Skip malformed or heartbeat comment lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
