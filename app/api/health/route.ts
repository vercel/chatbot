/**
 * GET /api/health — Lightweight health check endpoint
 * Used by deploy webhook and monitoring
 */

import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, boolean> = {
    postgres: !!process.env.POSTGRES_URL,
    vercel: !!process.env.VERCEL_URL,
    slack: !!process.env.SLACK_BOT_TOKEN,
  };

  const allOk = Object.values(checks).every(Boolean);

  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", checks, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  );
}

