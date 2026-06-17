/**
 * Phase 24: Self-Healing Ingest Endpoint
 *
 * POST /api/self-healing/ingest
 * Accepts raw logs from any source (Slack, Sentry, billing alerts).
 * Runs through: analyze → KG match → wiki update intent → maybe spawn mission.
 *
 * Auth: Bearer token (NEPTUNE_INTERNAL_TOKEN env)
 *
 * Body: { source: string, rawLog: string }
 * Response: { analysisId, missionId?, needsFix, severity, kgMatches }
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeLog } from "@/lib/ai/self-healing/log-analyzer";
import { updateWiki } from "@/lib/ai/self-healing/wiki-updater";
import { spawnMission } from "@/lib/ai/self-healing/auto-mission-spawner";

const INTERNAL_TOKEN = process.env.NEPTUNE_INTERNAL_TOKEN || "";

export async function POST(req: NextRequest) {
  const requestId = `sh-ingest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startTime = Date.now();

  // Auth
  if (INTERNAL_TOKEN) {
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (token !== INTERNAL_TOKEN) {
      return NextResponse.json(
        { error: "Unauthorized", requestId },
        { status: 401 }
      );
    }
  }

  // Parse body
  let body: { source: string; rawLog: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", requestId },
      { status: 400 }
    );
  }

  const { source, rawLog } = body;
  if (!source || !rawLog) {
    return NextResponse.json(
      {
        error: "Missing required fields: source, rawLog",
        requestId,
      },
      { status: 400 }
    );
  }

  console.log(
    `[self-healing] [${requestId}] 📨 Ingesting log from "${source}" (${rawLog.length} chars)`
  );

  try {
    // Step 1: Analyze log
    const analysis = await analyzeLog(rawLog, source);
    console.log(
      `[self-healing] [${requestId}] Analysis: severity=${analysis.extracted.severity}, needsFix=${analysis.needsFix}, kgMatches=${analysis.kgMatches.length}`
    );

    // Step 2: Wiki update intent (dry-run)
    let wikiResult = null;
    if (analysis.needsFix && analysis.kgMatches.length > 0) {
      const topMatch = analysis.kgMatches[0];
      wikiResult = await updateWiki(
        topMatch.playbook,
        `Self-healing: ${analysis.extracted.hypothesis}`,
        `## Detected Issue (${new Date().toISOString()})\n\n` +
          `- **Source:** ${source}\n` +
          `- **Severity:** ${analysis.extracted.severity}\n` +
          `- **Finding:** ${analysis.extracted.what}\n` +
          `- **Hypothesis:** ${analysis.extracted.hypothesis}\n`,
        { append: true }
      );
    }

    // Step 3: Maybe spawn mission
    let missionId: string | undefined;
    if (analysis.needsFix) {
      const mission = await spawnMission(analysis);
      if (mission) {
        missionId = mission.missionId;

        // If we have a DB ID, update with mission reference
        if (analysis.id && mission) {
          // In production: update library_log_analyses SET v2_mission_id
          console.log(
            `[self-healing] [${requestId}] Mission spawned: ${mission.title} (${mission.missionId})`
          );
        }
      }
    }

    return NextResponse.json({
      received: true,
      requestId,
      analysisId: analysis.id,
      missionId: missionId || null,
      needsFix: analysis.needsFix,
      severity: analysis.extracted.severity,
      hypothesis: analysis.extracted.hypothesis,
      kgMatches: analysis.kgMatches.length,
      wikiUpdated: wikiResult !== null,
      processingTimeMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error(
      `[self-healing] [${requestId}] ❌ Pipeline error:`,
      (err as Error).message
    );
    return NextResponse.json(
      {
        error: "Pipeline execution failed",
        details: (err as Error).message,
        requestId,
      },
      { status: 500 }
    );
  }
}
