/**
 * Phase 15.C — Dashboard API
 *
 * GET /api/admin/dashboard?hours=168  — Aggregated KPI data
 */

import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";

const POSTGRES_URL = process.env.POSTGRES_URL;

export async function GET(req: NextRequest) {
  if (!POSTGRES_URL) return NextResponse.json({ error: "POSTGRES_URL not set" }, { status: 500 });
  const sqlClient = postgres(POSTGRES_URL, { max: 2 });
  const db = drizzle(sqlClient);

  try {
    const url = new URL(req.url);
    const hours = parseInt(url.searchParams.get("hours") || "168");
    const since = new Date(Date.now() - hours * 3600 * 1000);
    const days = Math.ceil(hours / 24);

    // Helper: execute SQL and get result rows as any[]
    const q = async (query: ReturnType<typeof sql>) => {
      const r = await db.execute(query);
      return r as unknown as any[];
    };

    // Total tokens from model usage logs
    const tokenResult = await q(sql`
      SELECT
        COALESCE(SUM(tokens_in), 0)::bigint as total_in,
        COALESCE(SUM(tokens_out), 0)::bigint as total_out,
        COUNT(*)::int as total_calls
      FROM library_model_usage_logs
      WHERE timestamp >= ${since.toISOString()}
    `);
    const totalTokens = (Number(tokenResult[0]?.total_in || 0)) + (Number(tokenResult[0]?.total_out || 0));

    // Per-day tokens
    const tokensPerDay = (await q(sql`
      SELECT
        DATE(timestamp) as date,
        COALESCE(SUM(tokens_in + tokens_out), 0)::bigint as tokens
      FROM library_model_usage_logs
      WHERE timestamp >= ${since.toISOString()}
      GROUP BY DATE(timestamp)
      ORDER BY date
    `)).map((r: any) => ({ date: String(r.date), tokens: Number(r.tokens) }));

    // Total cost
    const costResult = await q(sql`
      SELECT COALESCE(SUM(cost_usd), 0)::numeric(12,4) as total_cost
      FROM library_model_usage_logs
      WHERE timestamp >= ${since.toISOString()}
    `);
    const costTotal = Number(costResult[0]?.total_cost || 0);

    // Per-day cost
    const costPerDay = (await q(sql`
      SELECT
        DATE(timestamp) as date,
        COALESCE(SUM(cost_usd), 0)::numeric(12,4) as cost
      FROM library_model_usage_logs
      WHERE timestamp >= ${since.toISOString()}
      GROUP BY DATE(timestamp)
      ORDER BY date
    `)).map((r: any) => ({ date: String(r.date), cost: Number(r.cost) }));

    // Top skills
    const topSkills = (await q(sql`
      SELECT
        skill_loaded as name,
        COUNT(*)::int as count,
        COALESCE(AVG(latency_actual_ms), 0)::int as avg_latency_ms
      FROM library_usage_logs
      WHERE timestamp >= ${since.toISOString()}
      GROUP BY skill_loaded
      ORDER BY count DESC
      LIMIT 10
    `)).map((r: any) => ({ name: r.name, count: r.count, avgLatencyMs: r.avg_latency_ms }));

    // Top models
    const topModels = (await q(sql`
      SELECT
        model_used as name,
        COUNT(*)::int as count,
        COALESCE(AVG(latency_ms), 0)::int as avg_latency_ms
      FROM library_model_usage_logs
      WHERE timestamp >= ${since.toISOString()}
      GROUP BY model_used
      ORDER BY count DESC
      LIMIT 10
    `)).map((r: any) => ({ name: r.name, count: r.count, avgLatencyMs: r.avg_latency_ms }));

    // Avg latency
    const avgLatencyMs = Number(
      (await q(sql`
        SELECT COALESCE(AVG(latency_ms), 0)::int as avg_latency
        FROM library_model_usage_logs
        WHERE timestamp >= ${since.toISOString()}
      `))[0]?.avg_latency || 0
    );

    // Eval pass rate
    const evalData = await q(sql`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'passed')::int as passed
      FROM library_eval_runs
    `);
    const evalTotal = Number(evalData[0]?.total || 0);
    const evalPassed = Number(evalData[0]?.passed || 0);
    const evalPassRate = evalTotal > 0 ? Math.round((evalPassed / evalTotal) * 100) : 0;

    // Eval pass rate trend
    const evalPassRateTrend = (await q(sql`
      SELECT
        DATE(run_at) as date,
        ROUND(
          (COUNT(*) FILTER (WHERE status = 'passed')::numeric / NULLIF(COUNT(*), 0) * 100)::numeric, 1
        ) as rate
      FROM library_eval_runs
      GROUP BY DATE(run_at)
      ORDER BY date
      LIMIT ${days}
    `)).map((r: any) => ({ date: String(r.date), rate: Number(r.rate) }));

    // Total sessions
    const totalSessions = Number(
      (await q(sql`
        SELECT COUNT(DISTINCT session_id)::int as total FROM library_usage_logs
        WHERE timestamp >= ${since.toISOString()}
      `))[0]?.total || 0
    );

    // Active models
    const activeModels = Number(
      (await q(sql`
        SELECT COUNT(DISTINCT model_used)::int as total FROM library_model_usage_logs
        WHERE timestamp >= ${since.toISOString()}
      `))[0]?.total || 0
    );

    // Total skills
    const totalSkills = Number(
      (await q(sql`
        SELECT COUNT(DISTINCT skill_loaded)::int as total FROM library_usage_logs
        WHERE timestamp >= ${since.toISOString()}
      `))[0]?.total || 0
    );

    await sqlClient.end();
    return NextResponse.json({
      tokensTotal: totalTokens,
      tokensPerDay,
      costTotal,
      costPerDay,
      topSkills,
      topModels,
      avgLatencyMs,
      evalPassRate,
      evalPassRateTrend,
      totalSessions,
      activeModels,
      totalSkills,
    });
  } catch (err: any) {
    await sqlClient.end();
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

