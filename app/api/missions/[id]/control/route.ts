/**
 * POST /api/missions/[id]/control — Send intervention command to a running mission
 *
 * Commands: pause, resume, inject, skip_stream, retry_stream, change_branch, abort
 * Each command updates the mission record + logs an event.
 *
 * Phase 38: Autonomous Coding Platform
 */

import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { libraryMission, libraryMissionEvent } from "@/lib/db/schema";
import type { InterventionCommand } from "@/lib/autonomous-mission/runner";

const dbClient = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(dbClient);

// In-memory store of active intervention handlers
// Keyed by missionId, value is a callback to trigger
const interventionCallbacks = new Map<
  string,
  (cmd: InterventionCommand) => void
>();

export function registerInterventionHandler(
  missionId: string,
  handler: (cmd: InterventionCommand) => void,
): void {
  interventionCallbacks.set(missionId, handler);
}

export function unregisterInterventionHandler(missionId: string): void {
  interventionCallbacks.delete(missionId);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body: InterventionCommand = await request.json();
    const { type, reason, instruction, streamId, branchName } = body;

    // Validate command
    const validCommands = [
      "pause",
      "resume",
      "inject",
      "skip_stream",
      "retry_stream",
      "change_branch",
      "abort",
    ];

    if (!validCommands.includes(type)) {
      return NextResponse.json(
        { error: `Invalid command type. Valid: ${validCommands.join(", ")}` },
        { status: 400 },
      );
    }

    // Validate required fields per command type
    if (type === "inject" && !instruction) {
      return NextResponse.json(
        { error: "instruction field required for inject command" },
        { status: 400 },
      );
    }
    if ((type === "skip_stream" || type === "retry_stream") && !streamId) {
      return NextResponse.json(
        { error: "streamId field required for skip/retry commands" },
        { status: 400 },
      );
    }
    if (type === "change_branch" && !branchName) {
      return NextResponse.json(
        { error: "branchName field required for change_branch command" },
        { status: 400 },
      );
    }

    // Update mission status in DB
    const statusMap: Record<string, string> = {
      pause: "PAUSED",
      resume: "EXECUTING",
      abort: "ABORTED",
    };

    const newStatus = statusMap[type];
    const updateData: Record<string, unknown> = {};

    if (newStatus) {
      updateData.status = newStatus;
    }
    if (type === "change_branch" && branchName) {
      // Store branch info in v2SessionId as a flexible field
      updateData.v2SessionId = `branch:${branchName}`;
    }

    if (Object.keys(updateData).length > 0) {
      await db
        .update(libraryMission)
        .set(updateData as any)
        .where(eq(libraryMission.id, id));
    }

    // Log event
    await db.insert(libraryMissionEvent).values({
      missionId: id,
      eventType: `command_${type}`,
      payload: {
        command: type,
        reason: reason ?? null,
        instruction: instruction ?? null,
        streamId: streamId ?? null,
        branchName: branchName ?? null,
        timestamp: new Date().toISOString(),
      },
      createdBy: session.user.email ?? "api",
    });

    // Dispatch to in-memory handler if registered
    const handler = interventionCallbacks.get(id);
    if (handler) {
      handler({
        type,
        reason,
        instruction,
        streamId,
        branchName,
      });
    }

    return NextResponse.json({
      ok: true,
      missionId: id,
      command: type,
      applied: !!handler,
      message: handler
        ? `Command "${type}" dispatched to running mission`
        : `Command "${type}" logged but no live handler found (mission may be complete or not running)`,
    });
  } catch (err) {
    console.error("[POST /api/missions/[id]/control]", err);
    return NextResponse.json(
      { error: `Failed to send command: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
