/**
 * code-handoff-bridge.ts — Bridge from Neptune Chat (V1) to Neptune Code (V2).
 *
 * When the intent classifier detects a code_handoff intent, the chat route
 * can call handoffToNeptuneCode() to POST the prompt to V2 and receive a
 * session ID + SSE stream URL for live progress.
 *
 * PRD ref: Section 3, Mode E — Code Handoff
 * V2 endpoint: neptune-v2.vercel.app /api/chat
 *
 * SKELETON: V2 must be configured to accept cross-surface handoff requests.
 * This bridge gracefully degrades when V2 is unavailable.
 */

const V2_CHAT_ENDPOINT =
  process.env.NEPTUNE_V2_CHAT_URL || 'https://neptune-v2.vercel.app/api/chat';
const V2_HANDOFF_SECRET = process.env.NEPTUNE_V2_HANDOFF_SECRET || '';

export interface HandoffRequest {
  prompt: string;
  context?: string;
  chatId?: string;
  userId?: string;
  modelId?: string;
}

export interface HandoffResponse {
  success: boolean;
  sessionId?: string;
  sessionUrl?: string;
  sseUrl?: string;
  error?: string;
  degraded: boolean;
}

/**
 * POST a code handoff request to Neptune V2.
 *
 * Returns a HandoffResponse with session ID and SSE URL for progress tracking.
 * Gracefully degrades if V2 is unreachable — returns { success: false, degraded: true }.
 */
export async function handoffToNeptuneCode(
  request: HandoffRequest
): Promise<HandoffResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (V2_HANDOFF_SECRET) {
    headers['Authorization'] = `Bearer ${V2_HANDOFF_SECRET}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(V2_CHAT_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
        chatId: request.chatId ?? `handoff-${Date.now()}`,
        userId: request.userId ?? 'neptune-chat',
        modelId: request.modelId ?? 'deepseek-v4-pro',
        source: 'neptune-chat',
        context: request.context,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        success: false,
        error: `V2 returned ${res.status}: ${body.substring(0, 200)}`,
        degraded: true,
      };
    }

    const data = await res.json();
    return {
      success: true,
      sessionId: data.sessionId ?? data.id,
      sessionUrl: data.sessionUrl ?? `https://neptune-v2.vercel.app/sessions/${data.sessionId ?? data.id}`,
      sseUrl: data.sseUrl,
      degraded: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: false,
      error: `V2 unreachable: ${message}`,
      degraded: true,
    };
  }
}

/**
 * Returns the SSE event stream URL for a V2 session.
 * Chat UI can open an EventSource to this URL for live progress.
 */
export function getV2ProgressStreamUrl(sessionId: string): string {
  const base = V2_CHAT_ENDPOINT.replace('/api/chat', '');
  return `${base}/api/sessions/${sessionId}/stream`;
}

/**
 * Health check — verifies V2 is reachable before attempting handoff.
 */
export async function checkV2Health(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    const res = await fetch(
      V2_CHAT_ENDPOINT.replace('/api/chat', '/api/health'),
      { signal: controller.signal }
    );

    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}
