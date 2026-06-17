/**
 * POST /api/missions — Create a mission
 * GET  /api/missions — List missions for current user
 */
import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, and, isNull } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { libraryMission } from "@/lib/db/schema";
import { generateUUID } from "@/lib/utils";

const dbClient = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(dbClient);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, steps, estimatedCost, estimatedTimeMin, chatId } = body;

    if (!title || !steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: "Title and steps array required" },
        { status: 400 }
      );
    }

    const missionId = generateUUID();
    const enrichedSteps = steps.map((step: Record<string, unknown>, idx: number) => ({
      id: generateUUID(),
      name: step.name || `Step ${idx + 1}`,
      type: step.type || "general",
      status: idx === 0 ? "running" : "pending",
      evidence: [],
      childCards: [],
    }));

    await db.insert(libraryMission).values({
      id: missionId,
      userId: session.user.id as unknown as string,
      title,
      steps: enrichedSteps,
      status: "running",
      estimatedCost: estimatedCost?.toString() ?? null,
      estimatedTimeMin: estimatedTimeMin ?? null,
      chatId: chatId ?? null,
      currentState: "inline",
      createdBy: "api",
    });

    return NextResponse.json({
      missionId,
      title,
      steps: enrichedSteps,
      status: "running",
      estimatedCost,
      estimatedTimeMin,
    });
  } catch (err) {
    console.error("[POST /api/missions]", err);
    return NextResponse.json(
      { error: "Failed to create mission" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get("chatId");
    const status = searchParams.get("status");

    const conditions = [eq(libraryMission.userId as any, session.user.id)];
    if (chatId) conditions.push(eq(libraryMission.chatId as any, chatId));
    if (status) conditions.push(eq(libraryMission.status, status));

    const missions = await db
      .select()
      .from(libraryMission)
      .where(and(...conditions))
      .orderBy(desc(libraryMission.createdAt))
      .limit(50);

    return NextResponse.json(missions);
  } catch (err) {
    console.error("[GET /api/missions]", err);
    return NextResponse.json(
      { error: "Failed to list missions" },
      { status: 500 }
    );
  }
}
