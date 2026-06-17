/**
 * POST /api/missions/[id]/events — Log a mission event
 * GET  /api/missions/[id]/events  — List mission events
 */
import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { libraryMissionEvent } from "@/lib/db/schema";

const dbClient = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(dbClient);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { eventType, payload } = body;

    await db.insert(libraryMissionEvent).values({
      missionId: id,
      eventType: eventType || "custom",
      payload: payload || {},
      createdBy: "api",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/missions/[id]/events]", err);
    return NextResponse.json(
      { error: "Failed to log event" },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const events = await db
      .select()
      .from(libraryMissionEvent)
      .where(eq(libraryMissionEvent.missionId, id))
      .orderBy(desc(libraryMissionEvent.createdAt))
      .limit(100);

    return NextResponse.json(events);
  } catch (err) {
    console.error("[GET /api/missions/[id]/events]", err);
    return NextResponse.json(
      { error: "Failed to get events" },
      { status: 500 }
    );
  }
}
