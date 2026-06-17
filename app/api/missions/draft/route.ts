/**
 * POST /api/missions/draft — Jarvis draft → VPS enhancement dispatch
 *
 * Accepts a PRD draft (path or inline content).
 * Creates a mission record with status DRAFT, triggers VPS enhancement.
 * Returns mission ID + plan-review URL + Slack notification.
 *
 * Part of ENHANCED PLANNING PATTERN (Stream 4):
 *   Jarvis CC (2-5 min) → VPS Enhance (10-15 min) → Human Approve → Execute
 *
 * Phase 38: Autonomous Coding Platform
 */
import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { auth } from "@/app/(auth)/auth";
import { libraryMission, libraryMissionEvent } from "@/lib/db/schema";
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
    const {
      prdPath,
      prdContent,
      title,
      description,
      mode = "ENHANCED",
      autoDeploy = false,
      autoSlack = true,
    } = body;

    if (!prdPath && !prdContent) {
      return NextResponse.json(
        { error: "Either prdPath or prdContent is required" },
        { status: 400 },
      );
    }

    // Resolve PRD content
    let resolvedContent = prdContent;
    let resolvedPath = prdPath || `inline-draft-${Date.now()}`;

    if (!resolvedContent && prdPath) {
      try {
        // Try Jarvis FS via Base44 bridge
        const base44Url = process.env.BASE44_BRIDGE_URL || "http://localhost:3001";
        const fsRes = await fetch(
          `${base44Url}/api/jarvis-fs/read?path=${encodeURIComponent(prdPath)}`,
          { headers: { Authorization: `Bearer ${process.env.BASE44_DIAG_KEY || ""}` } },
        );
        if (fsRes.ok) {
          const fsData = await fsRes.json();
          resolvedContent = fsData.content;
        } else {
          // Try local filesystem
          const { readFile } = await import("node:fs/promises");
          resolvedContent = await readFile(
            `/home/neptune/neptune-chat/${prdPath}`, "utf-8",
          );
          resolvedPath = prdPath;
        }
      } catch {
        return NextResponse.json(
          { error: `PRD not found at path: ${prdPath}` },
          { status: 404 },
        );
      }
    }

    if (!resolvedContent) {
      return NextResponse.json({ error: "No PRD content resolved" }, { status: 400 });
    }

    const missionId = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Create draft mission record
    await db.insert(libraryMission).values({
      id: missionId,
      userId: session.user.id as unknown as string,
      title: title || "PRD Draft",
      status: "draft",
      steps: [],
      currentState: "draft",
      createdBy: session.user.email ?? "jarvis",
      result: {
        prdPath: resolvedPath,
        description: description || "",
        mode,
        draftContent: resolvedContent.slice(0, 5000),
      },
    });

    // Log draft event
    await db.insert(libraryMissionEvent).values({
      missionId,
      eventType: "plan_draft_created",
      payload: {
        prdPath: resolvedPath,
        mode,
        title,
        autoDeploy,
        autoSlack,
      },
      createdBy: "jarvis",
    });

    // Fire-and-forget: trigger VPS enhancement
    if (mode === "ENHANCED") {
      const enhanceUrl = `${request.nextUrl.origin}/api/missions/${missionId}/enhance`;
      fetch(enhanceUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prdPath: resolvedPath,
          prdContent: resolvedContent,
          title,
          description,
          autoSlack,
        }),
      }).catch(err => {
        console.error("[Mission draft] Enhancement trigger failed:", err);
      });
    }

    // Post Slack notification
    if (autoSlack) {
      try {
        const slackUrl = process.env.SLACK_WEBHOOK_URL;
        if (slackUrl) {
          fetch(slackUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: [
                `📝 *Plan Draft Ready*`,
                `📋 ${title || "PRD Draft"}`,
                `🔄 Dispatching to VPS for enhancement...`,
                `🔗 ${request.nextUrl.origin}/missions/${missionId}/plan-review`,
              ].join("\n"),
            }),
          }).catch(() => {});
        }
      } catch { /* Slack is best-effort */ }
    }

    return NextResponse.json({
      missionId,
      status: "draft",
      mode,
      prdPath: resolvedPath,
      planReviewUrl: `/missions/${missionId}/plan-review`,
      sseUrl: `/api/missions/${missionId}/stream`,
      message: mode === "ENHANCED"
        ? "Draft created. VPS enhancement started. Check plan-review URL for results."
        : "Draft created. Review at plan-review URL.",
    });
  } catch (err) {
    console.error("[POST /api/missions/draft]", err);
    return NextResponse.json(
      { error: `Failed to create draft: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
