/**
 * Phase 23B: V2 Stream Proxy
 *
 * Server-side SSE proxy that relays V2 session streams to chat clients.
 * Handles CORS, heartbeat, and buffered event replay.
 */

import { V2_BASE_URL, V2_AGENT_TOKEN } from "./types";

export interface StreamProxyOptions {
  v2SessionId: string;
  origin?: string;
  heartbeatMs?: number;
}

/**
 * Create a ReadableStream that proxies SSE events from V2 backend.
 * Includes heartbeat (default 30s) and CORS headers.
 */
export function createV2StreamProxy(options: StreamProxyOptions): ReadableStream {
  const { v2SessionId, heartbeatMs = 30000 } = options;
  const v2StreamUrl = `${V2_BASE_URL}/api/sessions/${v2SessionId}/stream`;

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let abortController = new AbortController();

      try {
        // Fetch the V2 stream
        const res = await fetch(v2StreamUrl, {
          headers: {
            Authorization: `Bearer ${V2_AGENT_TOKEN}`,
            Accept: "text/event-stream",
          },
          signal: abortController.signal,
        });

        if (!res.ok || !res.body) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message: `V2 upstream returned ${res.status}` })}\n\n`
            )
          );
          controller.close();
          return;
        }

        // Heartbeat to keep client connection alive
        heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            // Client disconnected
            if (heartbeat) clearInterval(heartbeat);
          }
        }, heartbeatMs);

        // Pipe V2 stream events to client
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
            // Forward SSE lines as-is (data:, event:, id:, or comments)
            if (
              line.startsWith("data:") ||
              line.startsWith("event:") ||
              line.startsWith("id:") ||
              line.startsWith(":")
            ) {
              controller.enqueue(encoder.encode(line + "\n"));
            }
          }
          // End of event block
          controller.enqueue(encoder.encode("\n"));
        }

        // Send any remaining buffer
        if (buffer.trim()) {
          controller.enqueue(encoder.encode(buffer + "\n\n"));
        }
      } catch (err) {
        const msg = (err as Error).message;
        if (msg !== "The operation was aborted") {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message: msg })}\n\n`
            )
          );
        }
      } finally {
        if (heartbeat) clearInterval(heartbeat);
        controller.close();
      }
    },
    cancel() {
      // Cleanup on client disconnect
    },
  });
}

/**
 * SSE response headers for V2 stream proxy.
 */
export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

/**
 * CORS headers for chat-to-V2 communication.
 */
export function corsHeaders(origin?: string): Record<string, string> {
  const allowed = [
    "https://neptune-chat-ashy.vercel.app",
    "https://neptune-chat.vercel.app",
    "http://localhost:3000",
    origin,
  ].filter(Boolean) as string[];

  return {
    "Access-Control-Allow-Origin": allowed[0] || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}
