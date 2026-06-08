/**
 * SSE stream for sandbox run progress.
 * GET /api/sandbox/stream/:id — Server-Sent Events stream.
 */
import type { NextRequest } from "next/server";
import { sandboxManager } from "@/lib/sandbox/manager";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = sandboxManager.getRun(id);

  if (!run) {
    return new Response(JSON.stringify({ error: "Sandbox run not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Send current state
      send({
        type: "status",
        runId: run.id,
        status: run.status,
        sandboxId: run.sandboxId,
      });

      // Poll for completion (since we track in-memory)
      const interval = setInterval(() => {
        const updated = sandboxManager.getRun(id);
        if (!updated) {
          clearInterval(interval);
          send({ type: "error", message: "Run not found" });
          controller.close();
          return;
        }

        if (updated.status === "completed") {
          send({
            type: "done",
            runId: updated.id,
            durationMs: updated.durationMs,
          });
          clearInterval(interval);
          controller.close();
        } else if (updated.status === "error") {
          send({ type: "error", runId: updated.id, stderr: updated.stderr });
          clearInterval(interval);
          controller.close();
        } else if (updated.status === "destroyed") {
          send({ type: "destroyed", runId: updated.id });
          clearInterval(interval);
          controller.close();
        }
      }, 500);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, 5 * 60_000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
