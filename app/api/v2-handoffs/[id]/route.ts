/**
 * Phase 23B: GET /api/v2-handoffs/[id]
 * Get a single V2 handoff session by ID.
 */

import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { libraryV2Handoff } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dbClient = postgres(process.env.POSTGRES_URL ?? "");
    const db = drizzle(dbClient);

    const [handoff] = await db
      .select()
      .from(libraryV2Handoff)
      .where(eq(libraryV2Handoff.id, id))
      .limit(1);

    if (!handoff) {
      return NextResponse.json({ error: "Handoff not found" }, { status: 404 });
    }

    return NextResponse.json(handoff);
  } catch (err) {
    console.error("[v2-handoffs] GET single error:", err);
    return NextResponse.json(
      { error: "Failed to fetch handoff", details: (err as Error).message },
      { status: 500 }
    );
  }
}
