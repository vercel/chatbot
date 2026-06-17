/**
 * GET  /api/missions/[id] — Get mission details
 * PATCH /api/missions/[id] — Update mission (transition state, update steps)
 */
import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import {
  libraryMission,
  libraryMissionEvent,
} from "@/lib/db/schema";

const dbClient = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(dbClient);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const missions = await db
      .select()
      .from(libraryMission)
      .where(eq(libraryMission.id, id))
      .limit(1);

    if (!missions.length) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(missions[0]);
  } catch (err) {
    console.error("[GET /api/missions/[id]]", err);
    return NextResponse.json(
      { error: "Failed to get mission" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const { steps, status, currentState, v2SessionId, sandboxUrl, result } =
      body;

    const updateData: Record<string, unknown> = {};
    if (steps !== undefined) updateData.steps = steps;
    if (status !== undefined) updateData.status = status;
    if (currentState !== undefined) updateData.currentState = currentState;
    if (v2SessionId !== undefined) updateData.v2SessionId = v2SessionId;
    if (result !== undefined) updateData.result = result;
    if (status === "completed" || status === "failed") {
      updateData.completedAt = new Date();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    await db
      .update(libraryMission)
      .set(updateData as any)
      .where(eq(libraryMission.id, id));

    // Log event
    await db.insert(libraryMissionEvent).values({
      missionId: id,
      eventType: currentState
        ? `state_${currentState}`
        : status
          ? `status_${status}`
          : "updated",
      payload: body,
      createdBy: "api",
    });

    // Re-fetch
    const missions = await db
      .select()
      .from(libraryMission)
      .where(eq(libraryMission.id, id))
      .limit(1);

    return NextResponse.json(missions[0]);
  } catch (err) {
    console.error("[PATCH /api/missions/[id]]", err);
    return NextResponse.json(
      { error: "Failed to update mission" },
      { status: 500 }
    );
  }
}
