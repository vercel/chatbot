/**
 * GET /api/twenty-sync/cron
 * Phase 39: Scheduled bidirectional sync trigger for Vercel Cron.
 *
 * Cron schedule: Every 30 minutes (star/30 star star star star)
 * Vercel Cron config in vercel.json: crons array with path and schedule
 * Auth: Vercel Cron sends x-vercel-cron header; fallback to CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import { scheduledFullSync, syncHealthCheck } from "@/lib/sync/bidirectional-sync";
import { getConsecutiveFailureCount } from "@/lib/sync/sync-events";

const CRON_SECRET = process.env.CRON_SECRET || process.env.TWENTY_SYNC_API_KEY || "";

function validateCronAuth(req: NextRequest): boolean {
  // Vercel Cron sends this header automatically
  const isVercelCron = req.headers.get("x-vercel-cron") === "true";
  if (isVercelCron) return true;

  // Fallback: Bearer token auth for manual triggers
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  return token === CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!validateCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  console.log("[cron-sync] ───── Scheduled sync started ─────");

  // Health check first
  const health = await syncHealthCheck();
  if (!health.twentyReachable || !health.base44Reachable) {
    console.error("[cron-sync] Health check failed:", health);
    return NextResponse.json(
      {
        status: "error",
        error: "One or more systems unreachable",
        health,
        duration: Date.now() - startTime,
      },
      { status: 503 }
    );
  }

  // Run full sync
  const result = await scheduledFullSync();
  const failureCount = getConsecutiveFailureCount();

  const response = {
    status: result.failed > 0 ? "partial" : "ok",
    health,
    sync: {
      totalRecords: result.totalRecords,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed,
    },
    failures: {
      consecutive: failureCount,
      threshold: 5,
      alerting: failureCount >= 5,
    },
    duration: Date.now() - startTime,
    nextRun: "~30 minutes",
  };

  console.log(`[cron-sync] ───── Complete: ${result.created}c ${result.updated}u ${result.failed}f in ${Date.now() - startTime}ms ─────`);

  return NextResponse.json(response);
}

/** Manual trigger via POST for admin use */
export async function POST(req: NextRequest) {
  return GET(req);
}
