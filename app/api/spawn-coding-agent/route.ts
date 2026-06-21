/**
 * POST /api/spawn-coding-agent — Stream A Fix (2026-06-20)
 *
 * API route that wraps the V2 handoff for the "Send to V2" button and
 * programmatic dispatch. Previously this route did not exist, causing
 * the UI button to 404 on every click.
 *
 * Accepts: { repo, mode, context, sessionId }
 * Returns: { success, sessionId, streamUrl, v2Url, handoff }
 *
 * Auth: NextAuth session required (matches v2-handoffs pattern)
 *
 * Cross-ref: lib/v2/handoff-client.ts, components/chat/send-to-v2-button.tsx
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { spawnV2Session } from "@/lib/v2/handoff-client";

// ─── Repo Mapping (from UI TargetRepo → owner/repo) ──────────────────────

const REPO_MAP: Record<string, string> = {
  "neptune-chat": "abhiswami2121/neptune-chat",
  "neptune-v2": "abhiswami2121/neptune-v2",
  "newleaf-financial": "abhiswami2121/newleaf-financial",
  portal: "abhiswami2121/portal",
  pay: "abhiswami2121/pay",
};

function mapRepo(repoId: string): string {
  return REPO_MAP[repoId] || `abhiswami2121/${repoId}`;
}

// ─── POST Handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const requestId = `sca-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized — login required" },
      { status: 401 },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      repo,
      mode = "auto",
      context,
      sessionId,
      goal: explicitGoal,
    } = body as {
      repo?: string;
      mode?: string;
      context?: string;
      sessionId?: string;
      goal?: string;
    };

    if (!context && !explicitGoal) {
      return NextResponse.json(
        { success: false, error: "context or goal is required" },
        { status: 400 },
      );
    }

    // Derive goal from context or explicit goal
    const goal = explicitGoal || context?.slice(0, 300) || "Code task from Neptune Chat";

    // Map repo to owner/repo format
    const targetRepo = repo ? mapRepo(repo) : undefined;

    // Map UI mode to V2 mode
    const v2Mode = mode === "investigation"
      ? "investigation"
      : "modify_existing";

    console.log(
      `[spawn-coding-agent] [${requestId}] Dispatching to V2: goal="${goal.slice(0, 80)}", repo=${targetRepo}, mode=${v2Mode}`,
    );

    const result = await spawnV2Session({
      goal,
      mode: v2Mode,
      targetRepo,
      context: {
        chatId: sessionId || null,
        userId: session.user.id,
        sourceContent: context?.slice(0, 2000) || null,
        dispatchedBy: "send-to-v2-button",
        requestId,
      },
    });

    if (!result.success) {
      console.error(
        `[spawn-coding-agent] [${requestId}] V2 handoff failed: code=${result.code}, error=${result.error}`,
      );
      return NextResponse.json(
        {
          success: false,
          error: result.error || "V2 handoff failed",
          code: result.code,
          suggestion: result.suggestion,
        },
        { status: result.code?.startsWith("V2_HTTP_") ? 502 : 500 },
      );
    }

    console.log(
      `[spawn-coding-agent] [${requestId}] ✅ V2 session spawned: ${result.sessionId}`,
    );

    // ── M-N-META: Also create local agent session for inline card ────────────
    const localSessionId = `as-v2-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const { createSession } = await import("@/lib/agent-session-store");
      const { emitSessionEvent } = await import("@/lib/agent-sse-manager");

      await createSession({
        sessionId: localSessionId,
        goal,
        mode: v2Mode as "modify_existing" | "new_project" | "investigation",
        repoName: targetRepo,
        status: "spawning",
        lane: "v2",
        runtime: "opus_4_6",
        model: "claude-sonnet-4-20250514",
        chatId: sessionId || null,
        userEmail: session?.user?.email || null,
        cardState: "inline",
        v2DirectUrl: `https://neptune-v2.vercel.app/agent-sessions/${result.sessionId}`,
      });

      await emitSessionEvent(localSessionId, "session:created", {
        goal,
        lane: "v2",
        mode: v2Mode,
      });

      await emitSessionEvent(localSessionId, "lane:assigned", {
        lane: "v2",
        v2SessionId: result.sessionId,
      });
    } catch (storeErr) {
      // Non-fatal: V2 session created but local card tracking failed
      console.warn(`[spawn-coding-agent] [${requestId}] Local session store failed:`, storeErr);
    }

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      status: result.status || "started",
      streamUrl: result.streamUrl,
      v2Url: result.v2Url,
      // M-N-META: Include agent session data for inline card
      agentSession: localSessionId
        ? {
            sessionId: localSessionId,
            lane: "v2" as const,
            goal,
            status: "spawning" as const,
            model: "Claude Sonnet 4",
            streamUrl: `/api/agent-sessions/${localSessionId}/sse`,
          }
        : null,
      handoffUrl: result.v2Url || `https://neptune-v2.vercel.app/agent-sessions/${result.sessionId}`,
      handoff: {
        sessionId: result.sessionId,
        mode: v2Mode,
        goal,
        status: "spawning" as const,
        repo: targetRepo,
        v2DirectUrl: `https://neptune-v2.vercel.app/agent-sessions/${result.sessionId}`,
      },
    });
  } catch (err) {
    console.error(
      `[spawn-coding-agent] [${requestId}] Unhandled error:`,
      (err as Error).message,
    );
    return NextResponse.json(
      {
        success: false,
        error: (err as Error).message || "Internal error",
      },
      { status: 500 },
    );
  }
}
