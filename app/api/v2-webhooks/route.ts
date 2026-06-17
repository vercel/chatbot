/**
 * Phase 24: V2 Webhook Receiver — Bidirectional Bridge (V2 → Chat)
 *
 * Receives status updates from Neptune V2 when coding sessions change state.
 * Validates with HMAC-SHA256 signature.
 * Updates library_v2_handoffs row.
 *
 * Auth: HMAC-SHA256 (V2_WEBHOOK_SECRET shared env)
 * Payload: { sessionId, status, result, error, progress, prUrl, deployUrl }
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { libraryV2Handoff } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const WEBHOOK_SECRET = process.env.V2_WEBHOOK_SECRET || "";

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

    const payload = JSON.parse(body);
    const { sessionId, status, result, error, progress, prUrl, deployUrl } = payload;

    if (!sessionId || !status) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, status" },
        { status: 400 }
      );
    }

    console.log(
      `[v2-webhooks] [${requestId}] 📨 V2 session ${sessionId}: ${status} (progress: ${progress ?? "N/A"})`
    );

    // Update library_v2_handoffs
    if (process.env.POSTGRES_URL) {
      const dbClient = postgres(process.env.POSTGRES_URL, { max: 3, idle_timeout: 10 });
      const db = drizzle(dbClient);

      try {
        const updateData: Record<string, unknown> = {
          status,
          endedAt: status === "completed" || status === "failed" ? new Date() : undefined,
        };
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
