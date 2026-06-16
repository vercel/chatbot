/**
 * Phase 23B: GET /api/v2-handoffs
 * List V2 handoff sessions with optional status filter.
 */

import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { libraryV2Handoff } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const dbClient = postgres(process.env.POSTGRES_URL ?? "");
    const db = drizzle(dbClient);
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

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
    const allHandoffs = await db.select({ status: libraryV2Handoff.status }).from(libraryV2Handoff);
    const running = allHandoffs.filter((h) => h.status === "running").length;
    const completed = allHandoffs.filter((h) => h.status === "completed").length;
    const failed = allHandoffs.filter((h) => h.status === "failed").length;

    return NextResponse.json({
      handoffs,
      aggregates: { running, completed, failed },
    });
  } catch (err) {
    console.error("[v2-handoffs] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch handoffs", details: (err as Error).message },
      { status: 500 }
    );
  }
}
