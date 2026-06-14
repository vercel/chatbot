/**
 * V2 Bidirectional Bridge - shared module for all Neptune V2 interactions.
 *
 * PRD ref: Section 3, Layer 4 - V2 Integration (Bidirectional)
 *
 * Chat -> V2 (handoff):     handoffToV2()  - POST /api/sessions
 * Chat <- V2 (read state):  listV2Sessions(), getV2Session(), streamV2Progress()
 * Chat -> V2 (control):     controlV2Session() - pause/resume/cancel
 *
 * Phase 9: Fixed sseUrl to return session-specific stream URL (not /api/chat).
 * Added sessionId resume support in handoffToV2().
 * U1.2: handoffToV2 includes auto-retry (1 retry with 2s backoff).
 * U1.2: All functions return structured results, never throw unhandled.
 */

// --- Configuration --------------------------------------------------------
import { secrets } from "@/secrets";

const NEPTUNE_V2_URL =
  secrets.neptuneV2.chatUrl || "https://neptune-v2.vercel.app";

const NEPTUNE_V2_HANDOFF_SECRET = secrets.neptuneV2.handoffSecret;
const NEPTUNE_INTERNAL_TOKEN = secrets.vps.internalToken;

const DEFAULT_TIMEOUT = 15_000;
const V2_HANDOFF_TIMEOUT = 60_000; // U1.2: 60s max for V2 handoff
const V2_CHAT_ENDPOINT = `${NEPTUNE_V2_URL}/api/chat`;
const V2_SESSIONS_ENDPOINT = `${NEPTUNE_V2_URL}/api/sessions`;

/** Phase 9: Build the correct session SSE stream URL */
function buildSessionStreamUrl(sessionId: string): string {
  return `${V2_SESSIONS_ENDPOINT}/${sessionId}/stream`;
}

// --- Types ----------------------------------------------------------------

export interface V2Session {
  sessionId?: string;
  id?: string;
  status?: string;
  createdAt?: string;
  created_at?: string;
  prompt?: string;
  model?: string;
  streamUrl?: string;
  sseUrl?: string;
  sessionUrl?: string;
}

export interface V2HandoffResult {
  success: boolean;
  sessionId?: string;
  sessionUrl?: string;
  sseUrl?: string;
  error?: string;
}

export interface V2SessionListResult {
  sessions: V2Session[];
  count: number;
  error?: string;
}

export interface V2SessionDetail extends V2Session {
  progress?: Array<{
    step: number;
    status: string;
    text?: string;
  }>;
  output?: string;
  error?: string;
}

export type V2ControlAction = "pause" | "resume" | "cancel";

export interface V2ControlResult {
  success: boolean;
  action: V2ControlAction;
  sessionId: string;
  error?: string;
}

// --- Shared Helpers -------------------------------------------------------

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = NEPTUNE_INTERNAL_TOKEN || NEPTUNE_V2_HANDOFF_SECRET;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Core Bridge API ------------------------------------------------------

/**
 * Hand off a coding task to Neptune V2 via /api/chat.
 * V2 uses chatId as the session identifier; the SSE stream is consumed
 * by the calling API route.
 *
 * Phase 9: Supports sessionId for resume. If sessionId is provided,
 * attempts GET /api/sessions/{sessionId} to check if the session exists.
 * If it does and is still active, returns the existing session's stream URL.
 * If 404 or terminal, creates a new session and logs a warning.
 *
 * U1.2: Auto-retry - first failure retries once with 2s backoff.
 * Second failure returns structured error.
 */
export async function handoffToV2(
  prompt: string,
  context?: string,
  model?: string,
  sessionId?: string
): Promise<V2HandoffResult> {
  // Phase 9: If sessionId provided, attempt resume first
  if (sessionId) {
    try {
      const resumeRes = await fetchWithTimeout(
        `${V2_SESSIONS_ENDPOINT}/${sessionId}`,
        { method: "GET", headers: authHeaders() },
        10_000
      );
      if (resumeRes.ok) {
        const sessionData = await resumeRes.json().catch(() => ({}));
        const status = sessionData.status ?? sessionData.state ?? "";
        if (!["completed", "failed", "aborted"].includes(status)) {
          // Session exists and is still active - return it for resume
          return {
            success: true,
            sessionId,
            sessionUrl: `${NEPTUNE_V2_URL}/sessions/${sessionId}`,
            sseUrl: buildSessionStreamUrl(sessionId),
          };
        }
      }
      // Session not found or terminal - log and continue to create new
      console.log(
        `[handoffToV2] Session ${sessionId} not found or terminal, creating new`
      );
    } catch {
      // Resume check failed, proceed to create new session
      console.log(
        `[handoffToV2] Resume check failed for ${sessionId}, creating new`
      );
    }
  }

  const chatId = `handoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const attempt = async (): Promise<V2HandoffResult> => {
    try {
      const res = await fetchWithTimeout(
        V2_CHAT_ENDPOINT,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: context
                  ? `${context}\n\n---\n\n${prompt}`
                  : prompt,
              },
            ],
            chatId,
            model: model ?? "deepseek-v4-pro",
            source: "neptune-chat",
            mode: "chat",
          }),
        },
        V2_HANDOFF_TIMEOUT
      );

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          success: false,
          error: `V2 returned ${res.status}: ${body.slice(0, 200)}`,
        };
      }

      // V2 returns SSE stream - read first event to confirm session started
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        let sessionStarted = false;
        // Read first few SSE events to confirm connection
        for (let i = 0; i < 5; i++) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = new TextDecoder().decode(value);
          if (text.includes('"type":"start"') || text.includes('"type":"start-step"')) {
            sessionStarted = true;
            break;
          }
        }
        reader.cancel(); // Don't consume full stream from bridge
        if (!sessionStarted) {
          return {
            success: false,
            error: "V2 session did not start - no start event in SSE stream",
          };
        }
      }

      // Phase 9: Return correct session stream URL, not /api/chat
      // Use chatId as sessionId (V2 identifies sessions by chatId)
      return {
        success: true,
        sessionId: chatId,
        sessionUrl: `${NEPTUNE_V2_URL}/chat/${chatId}`,
        sseUrl: buildSessionStreamUrl(chatId),
      };
    } catch (err) {
      return {
        success: false,
        error: `V2 handoff failed: ${err instanceof Error ? err.message : "Unknown"}`,
      };
    }
  };

  // U1.2: Auto-retry - first attempt fails, retry once with 2s backoff
  const firstAttempt = await attempt();
  if (firstAttempt.success) return firstAttempt;

  // Only retry on transient errors (timeout, network, 503, 502)
  const errorMsg = firstAttempt.error || "";
  const isRetryable =
    errorMsg.includes("timeout") ||
    errorMsg.includes("abort") ||
    errorMsg.includes("fetch") ||
    errorMsg.includes("ECONNREFUSED") ||
    errorMsg.includes("503") ||
    errorMsg.includes("502") ||
    errorMsg.includes("unreachable");

  if (!isRetryable) return firstAttempt;

  // Wait 2s then retry
  await new Promise((r) => setTimeout(r, 2000));
  return attempt();
}

/**
 * List recent Neptune V2 coding sessions.
 */
export async function listV2Sessions(
  status?: string,
  limit = 10
): Promise<V2SessionListResult> {
  try {
    const params = new URLSearchParams({
      limit: String(Math.min(limit, 25)),
    });
    if (status && status !== "all") {
      params.set("status", status);
    }

    const res = await fetchWithTimeout(
      `${NEPTUNE_V2_URL}/api/sessions/list?${params.toString()}`,
      { headers: authHeaders() },
      10_000
    );

    if (!res.ok) {
      return {
        sessions: [],
        count: 0,
        error: `V2 returned ${res.status}`,
      };
    }

    const data = await res.json();
    const sessions = data.sessions ?? data ?? [];

    return {
      sessions: Array.isArray(sessions) ? sessions : [sessions],
      count: Array.isArray(sessions) ? sessions.length : 0,
    };
  } catch (err) {
    return {
      sessions: [],
      count: 0,
      error: `V2 unreachable: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

/**
 * Get detailed information about a specific V2 session.
 */
export async function getV2Session(
  sessionId: string
): Promise<V2SessionDetail> {
  try {
    const res = await fetchWithTimeout(
      `${NEPTUNE_V2_URL}/api/sessions/${sessionId}`,
      { headers: authHeaders() },
      10_000
    );

    if (!res.ok) {
      return {
        sessionId,
        error: `V2 returned ${res.status} for session ${sessionId}`,
      };
    }

    const data = await res.json();

    return {
      sessionId,
      status: data.status ?? "unknown",
      createdAt: data.createdAt ?? data.created_at,
      progress: data.progress,
      output: data.output,
      ...data,
    };
  } catch (err) {
    return {
      sessionId,
      error: `V2 unreachable: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

/**
 * Get the SSE stream URL for a V2 session.
 * Phase 9: Returns session-specific stream URL, not generic /api/chat.
 */
export function getV2StreamUrl(sessionId: string): string {
  return buildSessionStreamUrl(sessionId);
}

/**
 * Get the V2 SSE stream as a ReadableStream for proxying.
 * Phase 9: Uses GET on session stream endpoint instead of POST to /api/chat.
 * Returns null if V2 is unreachable.
 */
export async function getV2SSEStream(
  sessionId: string
): Promise<ReadableStream<Uint8Array> | null> {
  try {
    const res = await fetch(buildSessionStreamUrl(sessionId), {
      method: "GET",
      headers: authHeaders(),
    });

    if (!res.ok || !res.body) {
      return null;
    }

    return res.body;
  } catch {
    return null;
  }
}

/**
 * Control a running V2 session (pause/resume/cancel).
 */
export async function controlV2Session(
  sessionId: string,
  action: V2ControlAction
): Promise<V2ControlResult> {
  try {
    const res = await fetchWithTimeout(
      `${NEPTUNE_V2_URL}/api/sessions/${sessionId}/control`,
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action }),
      },
      10_000
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        success: false,
        action,
        sessionId,
        error: `V2 returned ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    return { success: true, action, sessionId };
  } catch (err) {
    return {
      success: false,
      action,
      sessionId,
      error: `V2 control failed: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

/**
 * Check if Neptune V2 is reachable.
 */
export async function pingV2(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${NEPTUNE_V2_URL}/api/health`,
      { method: "GET" },
      5000
    );
    return res.ok;
  } catch {
    return false;
  }
}
