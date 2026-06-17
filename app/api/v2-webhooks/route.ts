/**
 * Phase 28: V2 Webhook Receiver — Bidirectional Bridge (V2 → Chat)
 * BULLETPROOF EDITION
 *
 * POST: Receives status updates from Neptune V2 when coding sessions change state.
 *       Validates with HMAC-SHA256 signature. Idempotent via eventId check.
 * GET:  SSE stream for HandoffCard live progress (eventId-based polling fallback).
 *
 * Auth: HMAC-SHA256 (V2_WEBHOOK_SECRET shared env)
 * Payload: { sessionId, status, eventId, result, error, progress, prUrl, deployUrl }
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { libraryV2Handoff } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const WEBHOOK_SECRET = process.env.V2_WEBHOOK_SECRET || "";
const POSTGRES_URL = process.env.POSTGRES_URL || "";

// ─── Event deduplication cache ──────────────────────────────────────────────
// In-memory LRU cache for recent event IDs (avoids DB trips for dupes)
const RECENT_EVENT_IDS = new Set<string>();
const MAX_CACHED_IDS = 1000;

function isDuplicateEventId(eventId: string): boolean {
  if (RECENT_EVENT_IDS.has(eventId)) return true;
  RECENT_EVENT_IDS.add(eventId);
  // Prune oldest entries if over limit
  if (RECENT_EVENT_IDS.size > MAX_CACHED_IDS) {
    const iter = RECENT_EVENT_IDS.values();
    for (let i = 0; i < 100; i++) {
      const next = iter.next();
      if (next.done) break;
      RECENT_EVENT_IDS.delete(next.value);
    }
  }
  return false;
}

// ─── HMAC Verification ──────────────────────────────────────────────────────

function verifySignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET || !signature) return false;
  try {
    const hmac = createHmac("sha256", WEBHOOK_SECRET);
    const digest = `sha256=${hmac.update(body).digest("hex")}`;
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ─── SSE Event Store (in-memory, session-scoped) ────────────────────────────

interface SSEClient {
  sessionId: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
}

const sseClients = new Map<string, Set<SSEClient>>();

function broadcastEvent(sessionId: string, data: Record<string, unknown>): void {
  const clients = sseClients.get(sessionId);
  if (!clients) return;
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.controller.enqueue(client.encoder.encode(message));
    } catch {
      clients.delete(client);
    }
  }
}

// ─── POST: Receive webhook ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const requestId = `v2wh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startTime = Date.now();

  try {
    const body = await req.text();
    const signature = req.headers.get("x-v2-signature-256") || "";

    // Verify HMAC
    if (!verifySignature(body, signature)) {
      console.warn(`[v2-webhooks] [${requestId}] ❌ Invalid signature`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(body) as {
      sessionId: string;
      status: string;
      eventId?: string;
      result?: string;
      error?: string;
      progress?: number;
      prUrl?: string;
      deployUrl?: string;
    };
    const { sessionId, status, eventId, result, error, progress, prUrl, deployUrl } = payload;

    if (!sessionId || !status) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, status" },
        { status: 400 }
      );
    }

    // Idempotency check
    if (eventId && isDuplicateEventId(eventId)) {
      console.log(`[v2-webhooks] [${requestId}] ⏭️ Duplicate event ${eventId}, skipping`);
      return NextResponse.json({ received: true, requestId, deduplicated: true });
    }

    console.log(
      `[v2-webhooks] [${requestId}] 📨 V2 session ${sessionId}: ${status} (progress: ${progress ?? "N/A"})`
    );

    // Update library_v2_handoffs
    if (POSTGRES_URL) {
      const dbClient = postgres(POSTGRES_URL, { max: 3, idle_timeout: 10 });
      const db = drizzle(dbClient);

      try {
        const updateData: Record<string, unknown> = { status };
        if (status === "completed" || status === "failed") {
          updateData.endedAt = new Date();
        }
        if (result) updateData.resultUrl = result;
        if (error) updateData.errorMessage = error;
        if (prUrl) updateData.resultUrl = prUrl;

        await db
          .update(libraryV2Handoff)
          .set(updateData)
          .where(eq(libraryV2Handoff.v2SessionId, sessionId));

        console.log(`[v2-webhooks] [${requestId}] ✅ Updated handoff ${sessionId} → ${status}`);
      } finally {
        await dbClient.end().catch(() => {});
      }
    }

    // Broadcast to SSE clients
    broadcastEvent(sessionId, { status, progress, prUrl, deployUrl, error, eventId });

    return NextResponse.json({
      received: true,
      requestId,
      processingTimeMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error(`[v2-webhooks] [${requestId}] ❌ Error:`, (err as Error).message);
    return NextResponse.json(
      { error: "Internal error", requestId },
      { status: 500 }
    );
  }
}

// ─── GET: SSE Stream for HandoffCard ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId query parameter" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const client: SSEClient = { sessionId, controller, encoder };

      // Register client
      if (!sseClients.has(sessionId)) {
        sseClients.set(sessionId, new Set());
      }
      sseClients.get(sessionId)!.add(client);

      // Send initial connected event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", sessionId })}\n\n`));

      console.log(`[v2-webhooks] SSE client connected for session ${sessionId.slice(0, 12)}...`);
    },
    cancel() {
      // Cleanup on disconnect
      const clients = sseClients.get(sessionId);
      if (clients) {
        // Remove all clients for this session on cancel (stream close)
        // In practice, each EventSource connection gets its own stream
        sseClients.delete(sessionId);
      }
      console.log(`[v2-webhooks] SSE client disconnected for session ${sessionId.slice(0, 12)}...`);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
