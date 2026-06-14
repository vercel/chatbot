/**
 * GET /api/evals/leaderboard — Aggregated leaderboard
 * Returns: per-domain stats, per-severity pass rates, top/bottom evals
 */

import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { libraryEval, libraryEvalRun } from "@/lib/db/schema";
import { sql, eq, desc } from "drizzle-orm";

const POSTGRES_URL = process.env.POSTGRES_URL;

export async function GET(_req: NextRequest) {
  if (!POSTGRES_URL) return NextResponse.json({ error: "POSTGRES_URL not set" }, { status: 500 });
  const sqlClient = postgres(POSTGRES_URL, { max: 1 });
  const db = drizzle(sqlClient);

  try {
    const q = async (query: ReturnType<typeof sql>) => {
      const r = await db.execute(query);
      return r as unknown as any[];
    };

    // Per-domain stats
    const domainStats = await q(sql`
      SELECT
        e.domain,
        COUNT(DISTINCT e.id)::int as total_evals,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'passed')::int as passed_runs,
        COUNT(DISTINCT r.id)::int as total_runs,
        COALESCE(AVG(r.quality_score)::int, 0) as avg_score,
        COALESCE(AVG(r.latency_ms)::int, 0) as avg_latency_ms
      FROM library_evals e
      LEFT JOIN library_eval_runs r ON r.eval_id = e.id
      GROUP BY e.domain
      ORDER BY avg_score DESC
    `);

    // Overall
    const overallRows = await q(sql`
      SELECT
        COUNT(*)::int as total_runs,
        COUNT(*) FILTER (WHERE status = 'passed')::int as passed_runs,
        COALESCE(AVG(quality_score)::numeric(5,1), 0) as avg_score,
        COALESCE(AVG(latency_ms)::int, 0) as avg_latency_ms
      FROM library_eval_runs
    `);

    // Recent runs (last 10)
    const recentRuns = await db
      .select({
        id: libraryEvalRun.id,
        evalName: libraryEval.evalName,
        domain: libraryEval.domain,
        status: libraryEvalRun.status,
        qualityGrade: libraryEvalRun.qualityGrade,
        qualityScore: libraryEvalRun.qualityScore,
        latencyMs: libraryEvalRun.latencyMs,
        runAt: libraryEvalRun.runAt,
      })
      .from(libraryEvalRun)
      .leftJoin(libraryEval, eq(libraryEvalRun.evalId, libraryEval.id))
      .orderBy(desc(libraryEvalRun.runAt))
      .limit(10);

    await sqlClient.end();
    return NextResponse.json({
      overall: overallRows[0] || null,
      byDomain: domainStats,
      recentRuns,
    });
  } catch (err: any) {
    await sqlClient.end();
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

