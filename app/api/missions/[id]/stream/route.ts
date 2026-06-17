/**
 * GET /api/missions/[id]/stream — SSE stream for live mission updates
 *
 * Enhanced for Phase 38 Autonomous Coding Platform.
 *
 * Opens an SSE connection that pushes events when mission state changes.
 * Events: init, step_update, status_change, mission_event, completed, error
 *
 * Mission events feed from libraryMissionEvent table, enabling:
 *  - STREAM_STARTED, STREAM_COMPLETE, STEP_STARTED, STEP_COMPLETE
 *  - FILE_CREATED, BUILD_COMPLETE, COMMIT_CREATED, DEPLOY_READY
 *  - CHECKPOINT_SAVED, PAUSED, RESUMED, ABORTED, etc.
 */
import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, gt } from "drizzle-orm";
import { libraryMission, libraryMissionEvent } from "@/lib/db/schema";

const dbClient = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(dbClient);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // stream is closed
        }
      };

      // Send heartbeat immediately to confirm connection
      enqueue({
        type: "heartbeat",
        missionId: id,
        timestamp: new Date().toISOString(),
      });

      // Send initial state
      let lastEventId: string | null = null;
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
            title: m.title,
            estimatedCost: m.estimatedCost,
            estimatedTimeMin: m.estimatedTimeMin,
          });
        } else {
          enqueue({
            type: "error",
            missionId: id,
            message: "Mission not found",
          });
          controller.close();
          return;
        }
      } catch (err) {
        enqueue({
          type: "error",
          missionId: id,
          message: (err as Error).message,
        });
      }

      // Poll for changes every 1.5 seconds (faster for autonomous missions)
      // 15-minute timeout (600 iterations × 1.5s = 900s)
      let lastStepHash = "";
      let lastStatus = "";
      let iterations = 0;
      const maxIterations = 600;
      const pollInterval = 1500;

      // Fetch initial events to establish baseline
      try {
        const initEvents = await db
          .select({ id: libraryMissionEvent.id })
          .from(libraryMissionEvent)
          .where(eq(libraryMissionEvent.missionId, id))
          .orderBy(desc(libraryMissionEvent.createdAt))
          .limit(1);

        if (initEvents.length > 0) {
          lastEventId = initEvents[0]!.id;
        }
      } catch {
        // Ignore
      }

      while (!closed && iterations < maxIterations) {
        try {
          // Check mission state
          const missions = await db
            .select()
            .from(libraryMission)
            .where(eq(libraryMission.id, id))
            .limit(1);

          if (missions.length > 0) {
            const m = missions[0]!;
            const currentStepHash = JSON.stringify(m.steps);

            // Status changes
            if (m.status !== lastStatus) {
              lastStatus = m.status ?? "";
              enqueue({
                type: "status_change",
                missionId: id,
                status: m.status,
                timestamp: new Date().toISOString(),
              });

              // Terminal states
              if (m.status === "completed" || m.status === "failed") {
                enqueue({
                  type: "completed",
                  missionId: id,
                  status: m.status,
                  result: m.result,
                  completedAt: m.completedAt,
                });

                // Send final events batch
                try {
                  const finalEvents = await db
                    .select()
                    .from(libraryMissionEvent)
                    .where(eq(libraryMissionEvent.missionId, id))
                    .orderBy(desc(libraryMissionEvent.createdAt))
                    .limit(50);

                  enqueue({
                    type: "final_events",
                    missionId: id,
                    events: finalEvents.reverse(),
                  });
                } catch {
                  // Ignore
                }

                break;
              }
            }

            // Step updates
            if (currentStepHash !== lastStepHash) {
              lastStepHash = currentStepHash;
              enqueue({
                type: "step_update",
                missionId: id,
                steps: m.steps,
                timestamp: new Date().toISOString(),
              });

              // Check for deploy step
              const steps = m.steps as Array<Record<string, unknown>>;
              const deployStep = steps?.find(
                (s: Record<string, unknown>) =>
                  (s.type === "deploy" || s.type === "v2_handoff") &&
                  s.status === "running",
              );
              if (deployStep && m.v2SessionId) {
                enqueue({
                  type: "sandbox_ready",
                  missionId: id,
                  url: m.v2SessionId.startsWith("branch:")
                    ? undefined
                    : `https://neptune-v2.vercel.app/sandbox/${m.v2SessionId}`,
                });
              }
            }
          }

          // Check for new autonomous mission events
          if (lastEventId) {
            try {
              const newEvents = await db
                .select()
                .from(libraryMissionEvent)
                .where(
                  eq(libraryMissionEvent.missionId, id),
                )
                .orderBy(desc(libraryMissionEvent.createdAt))
                .limit(20);

              const freshEvents = newEvents.filter(
                e => e.id > lastEventId!,
              );

              for (const event of freshEvents.reverse()) {
                enqueue({
                  type: "mission_event",
                  missionId: id,
                  eventType: event.eventType,
                  payload: event.payload,
                  createdAt: event.createdAt,
                });
              }

              if (freshEvents.length > 0) {
                lastEventId = newEvents[0]!.id;
              }
            } catch {
              // Ignore event polling errors
            }
          }

          // Heartbeat every ~5 polls (7.5s)
          if (iterations % 5 === 0) {
            enqueue({
              type: "heartbeat",
              missionId: id,
              timestamp: new Date().toISOString(),
            });
          }
        } catch {
          // Poll errors are ignored — resume next iteration
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
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
