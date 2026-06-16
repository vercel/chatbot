/**
 * Phase 23B: GET /api/v2-handoffs/[id]/stream
 * SSE proxy that relays V2 session stream events to chat clients.
 * Handles CORS and heartbeat for long-lived connections.
 */

import { NextRequest, NextResponse } from "next/server";
import { createV2StreamProxy, SSE_HEADERS, corsHeaders } from "@/lib/v2/stream-proxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const origin = req.headers.get("origin") || undefined;

  // OPTIONS preflight
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    const stream = createV2StreamProxy({
      v2SessionId: id,
      origin,
      heartbeatMs: 30000,
    });

    return new NextResponse(stream, {
      headers: {
        ...SSE_HEADERS,
        ...corsHeaders(origin),
      },
    });
  } catch (err) {
    console.error(`[v2-handoffs] Stream proxy error for ${id}:`, err);
    return NextResponse.json(
      { error: "Stream proxy failed", details: (err as Error).message },
      { status: 500 }
    );
  }
}
