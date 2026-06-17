/**
 * GET /api/discovery/sse?runId=xxx — SSE event stream for a discovery run
 *
 * Streams real-time SSE events: step_start, step_progress, step_complete,
 * step_error, step_skip, run_complete, run_error.
 */

import { NextRequest } from "next/server";
import { subscribeToRun } from "../run/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId");

  if (!runId) {
    return new Response("runId query parameter required", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ runId })}\n\n`)
      );

      // Subscribe to run events
      const unsubscribe = subscribeToRun(runId, (event) => {
        try {
          const data = JSON.stringify(event);
          controller.enqueue(
            encoder.encode(`event: ${event.type}\ndata: ${data}\n\n`)
          );

          // Close stream on terminal events
          if (event.type === "run_complete" || event.type === "run_error") {
            controller.enqueue(
              encoder.encode(`event: stream_end\ndata: ${JSON.stringify({ reason: event.type })}\n\n`)
            );
            controller.close();
            unsubscribe();
          }
        } catch (err) {
          console.error("SSE write error:", err);
        }
      });

      // Timeout after 10 minutes if no completion
      const timeout = setTimeout(() => {
        try {
          controller.enqueue(
            encoder.encode(`event: stream_timeout\ndata: ${JSON.stringify({ message: "Run exceeded 10 minute timeout" })}\n\n`)
          );
          controller.close();
        } catch {
          // Already closed
        }
        unsubscribe();
      }, 10 * 60 * 1000);

      // Cleanup on abort
      request.signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        unsubscribe();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
