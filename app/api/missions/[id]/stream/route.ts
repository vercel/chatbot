/**
 * GET /api/missions/[id]/stream — SSE stream for live mission updates
 *
 * Opens an SSE connection that pushes events when mission state changes.
 * Events: step_update, status_change, sandbox_ready, completed, error
 */
import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { libraryMission } from "@/lib/db/schema";

const dbClient = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(dbClient);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // stream is closed
        }
      };

      // Send initial state
      try {
        const missions = await db
          .select()
          .from(libraryMission)
          .where(eq(libraryMission.id, id))
          .limit(1);

        if (missions.length > 0) {
          const m = missions[0]!;
          enqueue({
            type: "init",
            missionId: id,
            status: m.status,
            steps: m.steps,
            currentState: m.currentState,
            v2SessionId: m.v2SessionId,
          });
        }
      } catch (err) {
        enqueue({ type: "error", message: (err as Error).message });
      }

      // Poll for changes every 2 seconds (15-minute timeout)
      let lastStepHash = "";
      let lastStatus = "";
      let iterations = 0;
      const maxIterations = 450; // 15 min

      while (!closed && iterations < maxIterations) {
        try {
          const missions = await db
            .select()
            .from(libraryMission)
            .where(eq(libraryMission.id, id))
            .limit(1);

          if (missions.length > 0) {
            const m = missions[0]!;
            const currentStepHash = JSON.stringify(m.steps);

            if (m.status !== lastStatus) {
              lastStatus = m.status ?? "";
              enqueue({ type: "status_change", status: m.status });

              if (m.status === "completed" || m.status === "failed") {
                enqueue({
                  type: "completed",
                  status: m.status,
                  result: m.result,
                });
                break;
              }
            }

            if (currentStepHash !== lastStepHash) {
              lastStepHash = currentStepHash;
              enqueue({ type: "step_update", steps: m.steps });

              // Check for deploy step with v2 session
              const steps = m.steps as Array<Record<string, unknown>>;
              const deployStep = steps?.find(
                (s: Record<string, unknown>) =>
                  (s.type === "deploy" || s.type === "v2_handoff") &&
                  s.status === "running"
              );
              if (deployStep && m.v2SessionId) {
                enqueue({
                  type: "sandbox_ready",
                  url: `https://neptune-v2.vercel.app/sandbox/${m.v2SessionId}`,
                });
              }
            }
          }
        } catch {
          // Poll errors are ignored
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
        iterations++;
      }

      if (!closed) {
        controller.close();
      }
    },
    cancel() {
      closed = true;
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
