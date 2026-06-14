/**
 * Phase 15.B — Evals API Routes
 *
 * GET  /api/evals           — List all eval definitions (with last run summary)
 * POST /api/evals/run        — Run all evals (or specific eval by id) batched
 * GET  /api/evals/leaderboard — Aggregated leaderboard by domain/severity
 * GET  /api/evals/[id]       — Single eval definition + recent runs
 */

import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { and, desc, eq, sql, gte, count, avg } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { libraryEval, libraryEvalRun } from "@/lib/db/schema";

const POSTGRES_URL = process.env.POSTGRES_URL;

// ── GET /api/evals — List all evals with optional filters ────────────────────

export async function GET(req: NextRequest) {
  if (!POSTGRES_URL) return NextResponse.json({ error: "POSTGRES_URL not set" }, { status: 500 });
  const sqlClient = postgres(POSTGRES_URL, { max: 1 });
  const db = drizzle(sqlClient);

  try {
    const url = new URL(req.url);
    const domain = url.searchParams.get("domain");
    const severity = url.searchParams.get("severity");
    const search = url.searchParams.get("search");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);

    let query = db.select().from(libraryEval).$dynamic();
    const conditions = [];

    if (domain) conditions.push(eq(libraryEval.domain, domain));
    if (severity) conditions.push(eq(libraryEval.severity, severity));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const evals = await query.limit(limit).orderBy(desc(libraryEval.createdAt));

    // Attach last run summary for each eval
    const enriched = await Promise.all(
      evals.map(async (e) => {
        const runs = await db
          .select({
            total: count(),
            passed: sql<number>`COUNT(*) FILTER (WHERE status = 'passed')`.mapWith(Number),
            failed: sql<number>`COUNT(*) FILTER (WHERE status = 'failed')`.mapWith(Number),
            lastRun: sql<string>`MAX(run_at)`.mapWith(String),
            avgScore: sql<number>`AVG(quality_score)`.mapWith(Number),
          })
          .from(libraryEvalRun)
          .where(eq(libraryEvalRun.evalId, e.id));

        return { ...e, runSummary: runs[0] || null };
      })
    );

    // Apply search filter client-side (post-join)
    const filtered = search
      ? enriched.filter(
          (e) =>
            e.evalName.toLowerCase().includes(search.toLowerCase()) ||
            e.query.toLowerCase().includes(search.toLowerCase())
        )
      : enriched;

    await sqlClient.end();
    return NextResponse.json({ evals: filtered, total: filtered.length });
  } catch (err: any) {
    await sqlClient.end();
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST /api/evals/run — Trigger eval batch ─────────────────────────────────
// Handled in route.ts for /api/evals/run

