/**
 * POST /api/hermes-vps/dispatch
 *
 * Fires a task to the VPS Claude SDK agent via Base44 hybridDispatch.
 * Client-side endpoint called by VpsDispatchModal.
 *
 * M-N-META: Also creates a local agent_session for inline AgentSessionCard.
 */
import { NextResponse } from "next/server";
import { dispatchToVps } from "@/playbook-skills/connectors/hermes-vps/actions";
import type { DispatchResult } from "@/playbook-skills/connectors/hermes-vps/actions";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, context, chatId, userEmail } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "prompt is required" } satisfies DispatchResult,
        { status: 400 }
      );
    }

    const result = await dispatchToVps(prompt, context);

    // ── M-N-META: Create local agent session for inline card ────────────────
    if (result.success && result.dispatchId) {
      const sessionId = `as-vps-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      try {
        const { createSession } = await import("@/lib/agent-session-store");
        const { emitSessionEvent } = await import("@/lib/agent-sse-manager");

        await createSession({
          sessionId,
          goal: prompt,
          mode: null,
          status: "spawning",
          lane: "vps",
          runtime: "claude_sdk",
          model: "claude-sdk",
          chatId: chatId || null,
          userEmail: userEmail || null,
          cardState: "inline",
        });

        await emitSessionEvent(sessionId, "session:created", {
          goal: prompt,
          lane: "vps",
        });

        await emitSessionEvent(sessionId, "lane:assigned", {
          lane: "vps",
          dispatchId: result.dispatchId,
        });

        // Attach session info to response
        (result as Record<string, unknown>).agentSession = {
          sessionId,
          lane: "vps",
          goal: prompt,
          status: "spawning",
          model: "Claude SDK",
          dispatchId: result.dispatchId,
          streamUrl: `/api/agent-sessions/${sessionId}/sse`,
        };
      } catch (storeErr) {
        console.warn("[hermes-vps/dispatch] Local session store failed:", storeErr);
      }
    }

    return NextResponse.json(result, {
      status: result.success ? 200 : 502,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: `Dispatch failed: ${err instanceof Error ? err.message : "Unknown"}`,
      } satisfies DispatchResult,
      { status: 500 }
    );
  }
}
