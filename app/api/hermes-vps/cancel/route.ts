/**
 * POST /api/hermes-vps/cancel
 *
 * Cancels a running VPS dispatch.
 * Called by VpsProgressCard cancel button.
 */
import { NextResponse } from "next/server";
import { cancelVpsDispatch } from "@/playbook-skills/connectors/hermes-vps/actions";
import type { CancelResult } from "@/playbook-skills/connectors/hermes-vps/actions";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { dispatchId } = body;

    if (!dispatchId || typeof dispatchId !== "string") {
      return NextResponse.json(
        { success: false, dispatchId: dispatchId || "unknown", error: "dispatchId is required" } satisfies CancelResult,
        { status: 400 }
      );
    }

    const result = await cancelVpsDispatch(dispatchId);

    return NextResponse.json(result, {
      status: result.success ? 200 : 502,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        dispatchId: "unknown",
        error: `Cancel failed: ${err instanceof Error ? err.message : "Unknown"}`,
      } satisfies CancelResult,
      { status: 500 }
    );
  }
}
