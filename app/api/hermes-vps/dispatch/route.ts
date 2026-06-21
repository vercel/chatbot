/**
 * POST /api/hermes-vps/dispatch
 *
 * Fires a task to the VPS Claude SDK agent via Base44 hybridDispatch.
 * Client-side endpoint called by VpsDispatchModal.
 */
import { NextResponse } from "next/server";
import { dispatchToVps } from "@/playbook-skills/connectors/hermes-vps/actions";
import type { DispatchResult } from "@/playbook-skills/connectors/hermes-vps/actions";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, context } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "prompt is required" } satisfies DispatchResult,
        { status: 400 }
      );
    }

    const result = await dispatchToVps(prompt, context);

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
