/**
 * POST /api/workflows/[id]/run — Execute a workflow template, creates a new mission
 */
import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import {
  libraryWorkflowTemplate,
  libraryWorkflowRun,
  libraryMission,
  libraryMissionEvent,
} from "@/lib/db/schema";
import { generateUUID } from "@/lib/utils";

const dbClient = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(dbClient);

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const results = await db
      .select()
      .from(libraryWorkflowTemplate)
      .where(eq(libraryWorkflowTemplate.id, id))
      .limit(1);

    if (!results.length) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const workflow = results[0]!;
    const missionId = generateUUID();

    // Clone steps from template
    const templateSteps = (workflow.steps || []) as Array<Record<string, unknown>>;
    const steps = templateSteps.map((step, idx) => ({
      id: generateUUID(),
      name: step.name || `Step ${idx + 1}`,
      type: step.type || "general",
      status: idx === 0 ? "running" : "pending",
      evidence: [],
      childCards: [],
    }));

    // Create mission
    await db.insert(libraryMission).values({
      id: missionId,
      userId: session.user.id as unknown as string,
      title: workflow.name,
      steps,
      status: "running",
      currentState: "inline",
      createdBy: "workflow",
    });

    await db.insert(libraryMissionEvent).values({
      missionId,
      eventType: "created_from_workflow",
      payload: { workflowId: id, workflowName: workflow.name },
      createdBy: "workflow",
    });

    // Record workflow run
    await db.insert(libraryWorkflowRun).values({
      workflowId: id,
      missionId,
      userId: session.user.id as unknown as string,
      status: "running",
      startedAt: new Date(),
    });

    return NextResponse.json({
      missionId,
      title: workflow.name,
      steps,
      status: "running",
      message: `Mission "${workflow.name}" created from workflow.`,
    });
  } catch (err) {
    console.error("[POST /api/workflows/[id]/run]", err);
    return NextResponse.json(
      { error: "Failed to run workflow" },
      { status: 500 }
    );
  }
}
