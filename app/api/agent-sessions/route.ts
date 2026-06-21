/**
 * /api/agent-sessions — Session List & Create (EXTENDED from PR #14 pattern)
 *
 * GET  /api/agent-sessions?chatId=X&lane=v2&status=running
 *      → Returns paginated list of sessions with optional filters.
 *
 * POST /api/agent-sessions
 *      Body: { goal, context, lane?, repo?, mode?, chatId? }
 *      → Creates a new agent session, routes to V2 or VPS lane.
 *
 * M-N-META PRD Quality + Beautiful Handoff (2026-06-21)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { listSessions, getSessionStats } from "@/lib/agent-session-store";
import { createAgentSession } from "@/lib/agent-session-bridge";
import type { SessionLane, SessionStatus } from "@/lib/agent-session-store";

// ── GET: List Sessions ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const requestId = `as-list-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const startTime = Date.now();

  try {
    const url = new URL(req.url);
    const chatId = url.searchParams.get("chatId") || undefined;
    const lane = (url.searchParams.get("lane") as SessionLane) || undefined;
    const status = (url.searchParams.get("status") as SessionStatus) || undefined;
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

    const sessions = await listSessions({ chatId, lane, status, limit });
    const stats = await getSessionStats({ chatId });

    console.log(
      `[agent-sessions] [${requestId}] ${sessions.length} sessions (${stats.running}r/${stats.completed}c/${stats.failed}f) in ${Date.now() - startTime}ms`
    );

    return NextResponse.json({
      sessions,
      stats,
      meta: { requestId, queryTimeMs: Date.now() - startTime },
    });
  } catch (err) {
    console.error(`[agent-sessions] [${requestId}] Error:`, err);
    return NextResponse.json(
      {
        sessions: [],
        stats: { total: 0, running: 0, completed: 0, failed: 0 },
        error: "Failed to list sessions",
        meta: { requestId, queryTimeMs: Date.now() - startTime },
      },
      { status: 500 }
    );
  }
}

// ── POST: Create Session ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const requestId = `as-create-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    const body = await req.json().catch(() => ({}));
    const { goal, context, lane, repo, mode, chatId, userEmail, parentSessionId, conversationId } = body as {
      goal?: string;
      context?: string;
      lane?: "v2" | "vps" | "auto";
      repo?: string;
      mode?: "investigation" | "modify_existing" | "new_project";
      chatId?: string;
      userEmail?: string;
      parentSessionId?: string;
      conversationId?: string;
    };

    if (!goal || typeof goal !== "string" || goal.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "goal is required" },
        { status: 400 }
      );
    }

    console.log(
      `[agent-sessions] [${requestId}] Creating session: goal="${goal.slice(0, 80)}", lane=${lane || "auto"}`
    );

    const result = await createAgentSession({
      goal: goal.trim(),
      context,
      lane: lane || "auto",
      repo,
      mode,
      chatId,
      userEmail,
      parentSessionId,
      conversationId,
    });

    return NextResponse.json(result, {
      status: result.success ? 201 : 500,
    });
  } catch (err) {
    console.error(`[agent-sessions] [${requestId}] Create error:`, err);
    return NextResponse.json(
      {
        success: false,
        error: (err as Error).message || "Internal error creating session",
      },
      { status: 500 }
    );
  }
}
