/**
 * Phase 23B: POST /api/v2-handoffs/[id]/stop
 * Cancel a running V2 handoff session.
 */

import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { libraryV2Handoff } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { stopV2Session } from "@/lib/v2/handoff-client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dbClient = postgres(process.env.POSTGRES_URL ?? "");
    const db = drizzle(dbClient);

    // Get the handoff to find v2_session_id
    const [handoff] = await db
      .select()
      .from(libraryV2Handoff)
      .where(eq(libraryV2Handoff.id, id))
      .limit(1);

    if (!handoff) {
      return NextResponse.json({ error: "Handoff not found" }, { status: 404 });
    }

    // Stop the V2 session
    if (handoff.v2SessionId) {
      await stopV2Session(handoff.v2SessionId);
    }

    // Update DB status
    await db
      .update(libraryV2Handoff)
      .set({ status: "cancelled", endedAt: new Date() })
      .where(eq(libraryV2Handoff.id, id));

    return NextResponse.json({ success: true, message: "Handoff cancelled" });
  } catch (err) {
    console.error("[v2-handoffs] Stop error:", err);
    return NextResponse.json(
      { error: "Failed to stop handoff", details: (err as Error).message },
      { status: 500 }
    );
  }
}
