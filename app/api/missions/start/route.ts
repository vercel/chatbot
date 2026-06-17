/**
 * POST /api/missions/start — Dispatch an autonomous coding mission
 *
 * Accepts a PRD path (in Jarvis FS) or inline PRD text.
 * Parses the PRD, creates a mission record, initializes the runner,
 * and starts execution in BACKGROUND mode.
 *
 * For LIVE mode, the client connects to /api/missions/[id]/stream for SSE.
 * For BACKGROUND mode, progress is posted to Slack at stream boundaries.
 *
 * Phase 38: Autonomous Coding Platform
 */

import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { libraryMission, libraryMissionEvent } from "@/lib/db/schema";
import { generateUUID } from "@/lib/utils";
import { parsePrdToPlan, type ExecutionPlan } from "@/lib/autonomous-mission/prd-parser";

const dbClient = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(dbClient);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      prdPath,
      prdContent,
      mode = "BACKGROUND",
      autoDeploy = false,
      autoPush = false,
      autoSlack = false,
      smokePaths = ["/"],
    } = body;

    // Validate input
    if (!prdPath && !prdContent) {
      return NextResponse.json(
        { error: "Either prdPath or prdContent is required" },
        { status: 400 },
      );
    }

    // Resolve PRD content
    let resolvedContent = prdContent;
    let resolvedPath = prdPath || "inline-prd";

    if (!resolvedContent && prdPath) {
      // Fetch PRD from Jarvis FS via MCP bridge
      try {
        const fsRes = await fetch(
          `${process.env.BASE44_BRIDGE_URL || "http://localhost:3001"}/api/jarvis-fs/read?path=${encodeURIComponent(prdPath)}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.BASE44_DIAG_KEY || ""}`,
            },
          },
        );

        if (fsRes.ok) {
          const fsData = await fsRes.json();
          resolvedContent = fsData.content;
          resolvedPath = prdPath;
        } else {
          // Try local filesystem
          const { readFile } = await import("node:fs/promises");
          try {
            resolvedContent = await readFile(
              `/home/neptune/neptune-chat/${prdPath}`,
              "utf-8",
            );
            resolvedPath = prdPath;
          } catch {
            return NextResponse.json(
              { error: `PRD not found at path: ${prdPath}` },
              { status: 404 },
            );
          }
        }
      } catch {
        return NextResponse.json(
          { error: `Failed to read PRD at: ${prdPath}` },
          { status: 500 },
        );
      }
    }

    if (!resolvedContent) {
      return NextResponse.json(
        { error: "No PRD content resolved" },
        { status: 400 },
      );
    }

    // Parse PRD to execution plan
    let plan: ExecutionPlan;
    try {
      plan = parsePrdToPlan(resolvedContent, resolvedPath);
    } catch (err) {
      return NextResponse.json(
        { error: `Failed to parse PRD: ${(err as Error).message}` },
        { status: 422 },
      );
    }

    // Create mission record
    const missionId = plan.missionId;
    const steps = plan.streams.flatMap((stream) =>
      stream.steps.map((step, idx) => ({
        id: step.id,
        name: step.description,
        type: step.type,
        status: "pending" as const,
        evidence: [stream.name, step.filePath].filter(Boolean) as string[],
        childCards: [],
      })),
    );

    const enrichedSteps = steps.map((step, idx) => ({
      ...step,
      status: idx === 0 ? ("running" as const) : ("pending" as const),
    }));

    await db.insert(libraryMission).values({
      id: missionId,
      userId: session.user.id as unknown as string,
      title: plan.prdName,
      steps: enrichedSteps,
      status: "running",
      estimatedCost: plan.estimatedTotalTokens.toString(),
      estimatedTimeMin: Math.ceil(plan.estimatedTotalTokens / 1000), // rough estimate
      chatId: body.chatId ?? null,
      currentState: "inline",
      createdBy: session.user.email ?? "neptune-agent",
    });

    // Log initial event
    await db.insert(libraryMissionEvent).values({
      missionId,
      eventType: "mission_started",
      payload: {
        prdName: plan.prdName,
        prdPath: resolvedPath,
        mode,
        streams: plan.streams.map(s => ({
          id: s.id,
          name: s.name,
          steps: s.steps.length,
          budget: s.budget,
        })),
        totalStreams: plan.streams.length,
        totalSteps: plan.streams.reduce((sum, s) => sum + s.steps.length, 0),
        estimatedTokens: plan.estimatedTotalTokens,
        branch: plan.targetBranch,
        autoDeploy,
        autoPush,
      },
      createdBy: "autonomous-runner",
    });

    // Trigger background execution if in BACKGROUND mode
    if (mode === "BACKGROUND") {
      // Fire-and-forget: start the runner in the background
      // In production, this would use a job queue (BullMQ, etc.)
      // For now, we use process.nextTick to not block the response
      const runnerUrl = `${request.nextUrl.origin}/api/missions/${missionId}/run`;
      fetch(runnerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          missionId,
          plan,
          mode,
          autoDeploy,
          autoPush,
          autoSlack,
          smokePaths,
        }),
      }).catch(err => {
        console.error(`[Mission start] Failed to trigger background runner:`, err);
      });
    }

    return NextResponse.json({
      missionId,
      prdName: plan.prdName,
      status: "running",
      mode,
      streams: plan.streams.map(s => ({
        id: s.id,
        name: s.name,
        steps: s.steps.length,
        budget: s.budget,
      })),
      totalStreams: plan.streams.length,
      totalSteps: plan.streams.reduce((sum, s) => sum + s.steps.length, 0),
      estimatedTokens: plan.estimatedTotalTokens,
      branch: plan.targetBranch,
      sseUrl: `/api/missions/${missionId}/stream`,
      detailUrl: `/missions/${missionId}`,
    });
  } catch (err) {
    console.error("[POST /api/missions/start]", err);
    return NextResponse.json(
      { error: `Failed to start mission: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
