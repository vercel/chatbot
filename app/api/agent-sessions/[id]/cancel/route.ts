/**
 * POST /api/agent-sessions/[id]/cancel — Cancel Running Session
 *
 * Cancels a running agent session:
 *   - V2 lane: POSTs cancel to Neptune V2 API
 *   - VPS lane: Cancels via hermes-vps dispatch cancel
 *
 * M-N-META PRD Quality + Beautiful Handoff (2026-06-21)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/agent-session-store";
import { emitSessionEvent } from "@/lib/agent-sse-manager";
import { cancelVpsDispatch } from "@/playbook-skills/connectors/hermes-vps/actions";

const NEPTUNE_V2_API_BASE =
  process.env.NEPTUNE_V2_API_BASE || "https://neptune-v2.vercel.app";
const NEPTUNE_INTERNAL_TOKEN =
  process.env.NEPTUNE_INTERNAL_TOKEN || "";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = `as-cancel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    const { id: sessionId } = await params;

    if (!sessionId || sessionId.length < 3) {
      return NextResponse.json(
        { success: false, error: "Invalid session ID" },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    // Only cancel active sessions
    if (session.status === "complete" || session.status === "failed") {
      return NextResponse.json({
        success: true,
        message: "Session already in terminal state — no action needed",
        status: session.status,
      });
    }

    console.log(
      `[agent-sessions] [${requestId}] Cancelling session ${sessionId} (lane=${session.lane})`
    );

    if (session.lane === "v2") {
      // Cancel via V2 API
      try {
        const res = await fetch(
          `${NEPTUNE_V2_API_BASE}/api/agent-sessions/${sessionId}/cancel`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${NEPTUNE_INTERNAL_TOKEN}`,
            },
          }
        );

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.warn(
            `[agent-sessions] [${requestId}] V2 cancel returned ${res.status}: ${body.slice(0, 200)}`
          );
        }
      } catch (err) {
        console.warn(
          `[agent-sessions] [${requestId}] V2 cancel network error:`,
          (err as Error).message
        );
      }
    } else if (session.lane === "vps") {
      // Cancel via VPS dispatch
      try {
        // Extract dispatchId from session metadata
        const dispatchId = (session as Record<string, unknown>).dispatchId as string | undefined;
        if (dispatchId) {
          await cancelVpsDispatch(dispatchId);
        }
      } catch (err) {
        console.warn(
          `[agent-sessions] [${requestId}] VPS cancel error:`,
          (err as Error).message
        );
      }
    }

    // Update local state
    await updateSession(sessionId, {
      status: "failed",
      completedAt: new Date(),
    });

    await emitSessionEvent(sessionId, "cancelled", {
      message: "Session cancelled by user",
    });

    return NextResponse.json({
      success: true,
      sessionId,
      status: "failed",
      message: "Session cancelled",
    });
  } catch (err) {
    console.error(`[agent-sessions] [${requestId}] Cancel error:`, err);
    return NextResponse.json(
      {
        success: false,
        error: (err as Error).message || "Failed to cancel session",
      },
      { status: 500 }
    );
  }
}
