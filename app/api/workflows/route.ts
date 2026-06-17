/**
 * POST /api/workflows — Save a new workflow template (from MissionCard "Save as Workflow")
 * GET  /api/workflows — List saved workflows for current user
 */
import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc, and, or } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import {
  libraryWorkflowTemplate,
  libraryWorkflowRun,
  libraryMission,
} from "@/lib/db/schema";
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
    const { name, description, steps, parameters, schedule, tags, missionId } = body;

    if (!name || !steps || !Array.isArray(steps)) {
      return NextResponse.json(
        { error: "Name and steps array required" },
        { status: 400 }
      );
    }

    const workflowId = generateUUID();

    // Save template
    await db.insert(libraryWorkflowTemplate).values({
      id: workflowId,
      userId: session.user.id as unknown as string,
      name,
      description: description || "",
      steps: steps as Record<string, unknown>[],
      parameters: parameters || {},
      schedule: schedule || null,
      tags: tags || [],
      isShared: body.isShared ?? false,
      createdBy: "api",
    });

    return NextResponse.json({
      workflowId,
      name,
      description,
      steps,
      message: `Workflow "${name}" saved. Use /workflow ${name} to run it.`,
    });
  } catch (err) {
    console.error("[POST /api/workflows]", err);
    return NextResponse.json(
      { error: "Failed to save workflow" },
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
    const tag = searchParams.get("tag");

    const conditions = [or(
      eq(libraryWorkflowTemplate.userId, session.user.id as any),
      eq(libraryWorkflowTemplate.isShared, true)
    )];

    // Fetch workflows
    let query = db
      .select()
      .from(libraryWorkflowTemplate)
      .where(and(...conditions))
      .orderBy(desc(libraryWorkflowTemplate.updatedAt))
      .limit(50);

    const workflows = await query;

    // For each, get last run
    const enriched = await Promise.all(
      workflows.map(async (wf) => {
        const runs = await db
          .select()
          .from(libraryWorkflowRun)
          .where(eq(libraryWorkflowRun.workflowId, wf.id))
          .orderBy(desc(libraryWorkflowRun.createdAt))
          .limit(1);

        const tags = wf.tags as string[] || [];
        if (tag && !tags.includes(tag)) return null;

        return {
          ...wf,
          lastRun: runs[0] || null,
        };
      })
    );

    const filtered = enriched.filter(Boolean);

    return NextResponse.json({
      workflows: filtered,
      total: filtered.length,
    });
  } catch (err) {
    console.error("[GET /api/workflows]", err);
    return NextResponse.json(
      { error: "Failed to list workflows" },
      { status: 500 }
    );
  }
}
