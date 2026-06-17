/**
 * Phase 24: GET /api/v2-handoffs — V2 Handoff Bulletproofing
 *
 * Lists V2 handoff sessions with optional status filter and aggregation.
 * ALWAYS returns 200 — even on DB error, returns empty handoffs + error metadata.
 *
 * Auth: NextAuth session required.
 */

import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { libraryV2Handoff } from "@/lib/db/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";

export async function GET(req: NextRequest) {
  const requestId = `v2h-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startTime = Date.now();

  // Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

    if (!process.env.POSTGRES_URL) {
      console.warn(`[v2-handoffs] [${requestId}] POSTGRES_URL not configured — returning empty`);
      return NextResponse.json({
        handoffs: [],
        aggregates: { running: 0, completed: 0, failed: 0 },
        meta: { requestId, dbAvailable: false, queryTimeMs: Date.now() - startTime },
      });
    }

    const dbClient = postgres(process.env.POSTGRES_URL, { max: 3, idle_timeout: 10 });
    const db = drizzle(dbClient);

    try {
      const conditions = [];
      if (status && status !== "all") {
        conditions.push(eq(libraryV2Handoff.status, status));
      }

      const handoffs = await db
        .select()
        .from(libraryV2Handoff)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(libraryV2Handoff.startedAt))
        .limit(limit);

      // Aggregates
      const allHandoffs = await db
        .select({ status: libraryV2Handoff.status })
        .from(libraryV2Handoff);

      const running = allHandoffs.filter((h) => h.status === "running").length;
      const completed = allHandoffs.filter((h) => h.status === "completed").length;
      const failed = allHandoffs.filter((h) => h.status === "failed").length;

      console.log(
        `[v2-handoffs] [${requestId}] ✅ ${handoffs.length} handoffs (${running}r/${completed}c/${failed}f) in ${Date.now() - startTime}ms`
      );

      return NextResponse.json({
        handoffs,
        aggregates: { running, completed, failed },
        meta: { requestId, dbAvailable: true, queryTimeMs: Date.now() - startTime },
      });
    } finally {
      await dbClient.end().catch(() => {});
    }
  } catch (err) {
    console.error(`[v2-handoffs] [${requestId}] ❌ Unexpected error:`, (err as Error).message);
    return NextResponse.json({
      handoffs: [],
      aggregates: { running: 0, completed: 0, failed: 0 },
      error: "Internal error — returning empty result set",
      meta: { requestId, dbAvailable: false, queryTimeMs: Date.now() - startTime },
    });
  }
}
