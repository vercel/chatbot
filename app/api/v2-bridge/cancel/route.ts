/**
 * POST /api/v2-bridge/cancel — Cancel an active V2 agent session.
 *
 * Body: { sessionId: string }
 *
 * Forwards cancel request to Neptune V2's agent-sessions/:id/cancel endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { secrets } from "@/secrets";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

const NEPTUNE_V2_API_BASE =
  process.env.NEPTUNE_V2_API_BASE || "https://neptune-v2.vercel.app";
const NEPTUNE_INTERNAL_TOKEN = secrets.vps.internalToken;

export const POST = requireAllowlist(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 },
      );
    }

    const v2Url = `${NEPTUNE_V2_API_BASE}/api/agent-sessions/${encodeURIComponent(sessionId)}/cancel`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (NEPTUNE_INTERNAL_TOKEN) {
      headers.Authorization = `Bearer ${NEPTUNE_INTERNAL_TOKEN}`;
    }

    const res = await fetch(v2Url, {
      method: "POST",
      headers,
      body: JSON.stringify({ reason: "User cancelled from chat" }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `V2 returned ${res.status}`, details: errBody },
        { status: 502 },
      );
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ cancelled: true, sessionId, v2Response: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
});
