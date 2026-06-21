/**
 * POST /api/hermes-vps/poll
 *
 * Polls the status of a running VPS dispatch.
 * Called by VpsProgressCard every 10s.
 */
import { NextResponse } from "next/server";
import { pollVpsDispatch } from "@/playbook-skills/connectors/hermes-vps/actions";
import type { PollResult } from "@/playbook-skills/connectors/hermes-vps/actions";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { dispatchId } = body;

    if (!dispatchId || typeof dispatchId !== "string") {
      return NextResponse.json(
        { success: false, dispatchId: dispatchId || "unknown", status: "lost", error: "dispatchId is required" } satisfies PollResult,
        { status: 400 }
      );
    }

    const result = await pollVpsDispatch(dispatchId);

    return NextResponse.json(result, {
      status: result.success ? 200 : 502,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        dispatchId: "unknown",
        status: "lost",
        error: `Poll failed: ${err instanceof Error ? err.message : "Unknown"}`,
      } satisfies PollResult,
      { status: 500 }
    );
  }
}
