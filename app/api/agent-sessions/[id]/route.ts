/**
 * GET /api/agent-sessions/[id] — Session Status
 *
 * Returns full session record with current status, progress, and result URLs.
 * Used by AgentSessionCard to resume state after page reload.
 *
 * M-N-META PRD Quality + Beautiful Handoff (2026-06-21)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/agent-session-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = `as-get-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    const { id } = await params;

    if (!id || id.length < 3) {
      return NextResponse.json(
        { error: "Invalid session ID" },
        { status: 400 }
      );
    }

    const session = await getSession(id);

    if (!session) {
      return NextResponse.json(
        { error: "Session not found", sessionId: id },
        { status: 404 }
      );
    }

    console.log(
      `[agent-sessions] [${requestId}] Session ${id}: status=${session.status}, lane=${session.lane}`
    );

    return NextResponse.json(session);
  } catch (err) {
    console.error(`[agent-sessions] [${requestId}] Error:`, err);
    return NextResponse.json(
      { error: "Failed to fetch session", details: (err as Error).message },
      { status: 500 }
    );
  }
}
