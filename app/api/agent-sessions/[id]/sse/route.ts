/**
 * GET /api/agent-sessions/[id]/sse — SSE Stream with Last-Event-ID Reconnection
 *
 * Server-Sent Events endpoint for live session progress.
 * Supports:
 *   - Last-Event-ID header for reconnection (replay missed events)
 *   - Heartbeat every 15s
 *   - Connection pooling via AgentSSEManager (max 50)
 *   - Auto-cleanup on client disconnect
 *
 * Event types: session:created, lane:assigned, status:change, progress:update,
 *              tool:start, tool:complete, tool:error, file:changed, build:log,
 *              deploy:status, pr:created, enhancement:finding, cost:update,
 *              pocock:phase, error, complete, cancelled, heartbeat
 *
 * M-N-META PRD Quality + Beautiful Handoff (2026-06-21)
 */

import { NextRequest } from "next/server";
import { getSession } from "@/lib/agent-session-store";
import { getSSEManager } from "@/lib/agent-sse-manager";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  if (!sessionId || sessionId.length < 3) {
    return new Response("Invalid session ID", { status: 400 });
  }

  // Verify session exists
  const session = await getSession(sessionId);
  if (!session) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ message: "Session not found" })}\n\n`,
      {
        status: 404,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }
    );
  }

  // Get Last-Event-ID for reconnection
  const lastEventId = req.headers.get("last-event-id") || null;

  const manager = getSSEManager();

  const stream = new ReadableStream({
    start(controller) {
      const client = manager.registerClient(sessionId, controller, lastEventId);

      if (!client) {
        // Pool full
        controller.enqueue(
          new TextEncoder().encode(
            `event: error\ndata: ${JSON.stringify({ message: "Connection pool full — try again later" })}\n\n`
          )
        );
        controller.close();
        return;
      }

      // Send initial state
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          `event: session:created\ndata: ${JSON.stringify({
            sessionId,
            goal: session.goal,
            lane: session.lane,
            status: session.status,
            timestamp: Date.now(),
          })}\n\n`
        )
      );

      // Replay missed events if reconnecting
      if (lastEventId) {
        manager.replayEvents(client).catch((err) => {
          console.error(
            `[agent-sessions/sse] Replay error for ${sessionId}:`,
            err
          );
        });
      }

      // If session is already terminal, send final state and close
      if (session.status === "complete" || session.status === "failed") {
        controller.enqueue(
          encoder.encode(
            `event: ${session.status === "complete" ? "complete" : "error"}\ndata: ${JSON.stringify({
              sessionId,
              status: session.status,
              deployUrl: session.deployUrl,
              prUrl: session.prUrl,
              timestamp: Date.now(),
            })}\n\n`
          )
        );
        manager.unregisterClient(client);
        controller.close();
        return;
      }
    },

    cancel() {
      // Client disconnected — manager handles cleanup via heartbeat failure detection
      console.log(`[agent-sessions/sse] Stream cancelled for ${sessionId}`);
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
