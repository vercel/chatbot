/**
 * Phase 23B: V2 Handoff Client
 *
 * Client library for communicating with the V2 backend
 * (neptune-v2.vercel.app) for long-running coding agent sessions.
 */

import { V2_BASE_URL, V2_AGENT_TOKEN } from "./types";
import type { V2HandoffEvent, V2SpawnRequest, V2SpawnResponse } from "./types";

export interface HandoffClientResult {
  success: boolean;
  sessionId?: string;
  streamUrl?: string;
  v2Url?: string;
  error?: string;
  code?: string;
  suggestion?: string;
}

/**
 * Spawn a new coding agent session on V2 backend.
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
        "Set V2_AGENT_TOKEN in the Vercel environment variables for neptune-chat.",
    };
  }

  try {
    const res = await fetch(`${V2_BASE_URL}/api/handoff/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${V2_AGENT_TOKEN}`,
      },
      body: JSON.stringify({
        goal,
        mode,
        targetRepo: targetRepo || null,
        context: context || {},
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      const isMissingTeamId = body.includes("VERCEL_TEAM_ID");
      return {
        success: false,
        code: `V2_HTTP_${res.status}`,
        error: body.slice(0, 500),
        suggestion: isMissingTeamId
          ? "V2 project is missing VERCEL_TEAM_ID env. Run Phase 23B Stream 1 Vercel env fix."
          : "Check V2 backend health at neptune-v2.vercel.app/api/health.",
      };
    }

    const data: V2SpawnResponse = await res.json();
    return {
      success: true,
      sessionId: data.v2SessionId,
      streamUrl: data.streamUrl,
      v2Url: data.v2Url,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      code: "V2_UNREACHABLE",
      error: msg,
      suggestion: "V2 backend is unreachable. Check neptune-v2.vercel.app.",
    };
  }
}

/**
 * Get status of a handoff session from V2.
 */
export async function getV2SessionStatus(
  v2SessionId: string
): Promise<{ status: string; eventCount: number; error?: string }> {
  try {
    const res = await fetch(
      `${V2_BASE_URL}/api/sessions/${v2SessionId}/status`,
      {
        headers: { Authorization: `Bearer ${V2_AGENT_TOKEN}` },
      }
    );
    if (!res.ok) {
      return { status: "unknown", eventCount: 0, error: `HTTP ${res.status}` };
    }
    return await res.json();
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
 */
export async function stopV2Session(
  v2SessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${V2_BASE_URL}/api/sessions/${v2SessionId}/stop`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${V2_AGENT_TOKEN}` },
      }
    );
    return { success: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Read SSE stream from V2 session, yielding parsed events.
 */
export async function* streamV2Events(
  v2SessionId: string
): AsyncGenerator<V2HandoffEvent> {
  const streamUrl = `${V2_BASE_URL}/api/sessions/${v2SessionId}/stream`;

  const res = await fetch(streamUrl, {
    headers: { Authorization: `Bearer ${V2_AGENT_TOKEN}` },
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
            // Skip malformed events
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
