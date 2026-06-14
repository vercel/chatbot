/**
 * /api/v2-bridge/stream/[sid] - Phase 9 SSE Proxy
 *
 * Proxies V2 session SSE stream to Chat client.
 * Validates auth, forwards to V2 GET /api/sessions/{sid}/stream,
 * streams events back with proper SSE headers.
 */

import { NextRequest, NextResponse } from "next/server";
import { secrets } from "@/secrets";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

const NEPTUNE_V2_BASE =
  process.env.NEPTUNE_V2_API_BASE || "https://neptune-v2.vercel.app";
const NEPTUNE_INTERNAL_TOKEN = secrets.vps.internalToken;

export const GET = requireAllowlist(async (
  req: NextRequest,
  { params }: { params: { sid: string } }
) => {
  const { sid } = params;

  if (!sid) {
    return NextResponse.json(
      { error: "Missing session ID" },
      { status: 400 }
    );
  }

  const v2Url = `${NEPTUNE_V2_BASE}/api/sessions/${sid}/stream`;
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
  };

  // Forward auth token
  if (NEPTUNE_INTERNAL_TOKEN) {
    headers.Authorization = `Bearer ${NEPTUNE_INTERNAL_TOKEN}`;
  }

  // Forward any query params from the client
  const v2UrlWithParams = new URL(v2Url);
  req.nextUrl.searchParams.forEach((value, key) => {
    v2UrlWithParams.searchParams.set(key, value);
  });

  try {
    const v2Res = await fetch(v2UrlWithParams.toString(), {
      method: "GET",
      headers,
    });

    if (!v2Res.ok) {
      // Return error as SSE event so client can display it
      const errorBody = await v2Res.text().catch(() => "Unknown error");
      const errorStream = new ReadableStream({
        start(controller) {
          const errorEvent = `event: error\ndata: ${JSON.stringify({
            type: "error",
            sessionId: sid,
            timestamp: Date.now(),
            data: {
              code: v2Res.status,
              message: `V2 returned ${v2Res.status}: ${errorBody.slice(0, 200)}`,
            },
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(errorEvent));
          controller.close();
        },
      });

      return new Response(errorStream, {
        status: 200, // Return 200 so EventSource doesn't error on status
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Stream the V2 response as SSE
    return new Response(v2Res.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[v2-bridge/stream] Proxy error:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error";

    const errorStream = new ReadableStream({
      start(controller) {
        const errorEvent = `event: error\ndata: ${JSON.stringify({
          type: "error",
          sessionId: sid,
          timestamp: Date.now(),
          data: {
            code: 502,
            message: `V2 unreachable: ${errorMessage}`,
          },
        })}\n\n`;
        controller.enqueue(new TextEncoder().encode(errorEvent));
        controller.close();
      },
    });

    return new Response(errorStream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }
});

// Support OPTIONS for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
