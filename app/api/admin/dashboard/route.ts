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

    // ── Mission KPI (Stream 8: Eve observability) ─────────────────────
    const missionData = await q(sql`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
        COUNT(*) FILTER (WHERE status = 'running')::int as running,
        COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
        COUNT(*) FILTER (WHERE status = 'failed')::int as failed,
        COUNT(*) FILTER (WHERE status = 'aborted')::int as aborted,
        COUNT(*) FILTER (WHERE status = 'enhancing')::int as enhancing,
        COUNT(*) FILTER (WHERE status = 'approved')::int as approved,
        COALESCE(SUM(estimated_time_min), 0)::int as total_est_minutes
      FROM library_missions
      WHERE created_at >= ${since.toISOString()}
    `);

    const missionKPI = {
      total: Number(missionData[0]?.total || 0),
      pending: Number(missionData[0]?.pending || 0),
      running: Number(missionData[0]?.running || 0),
      completed: Number(missionData[0]?.completed || 0),
      failed: Number(missionData[0]?.failed || 0),
      aborted: Number(missionData[0]?.aborted || 0),
      enhancing: Number(missionData[0]?.enhancing || 0),
      approved: Number(missionData[0]?.approved || 0),
      totalEstMinutes: Number(missionData[0]?.total_est_minutes || 0),
    };

    // Per-day mission completions
    const missionsPerDay = (await q(sql`
      SELECT
        DATE(created_at) as date,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'completed')::int as completed
      FROM library_missions
      WHERE created_at >= ${since.toISOString()}
      GROUP BY DATE(created_at)
      ORDER BY date
    `)).map((r: any) => ({
      date: String(r.date),
      total: Number(r.total),
      completed: Number(r.completed),
    }));

    // ── V2 Session Health (Stream 7: V2 alignment) ─────────────────────
    // Query V2 handoff sessions
    const v2SessionData = await q(sql`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'running')::int as running,
        COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
        COUNT(*) FILTER (WHERE status = 'failed')::int as failed
      FROM library_handoff_sessions
      WHERE started_at >= ${since.toISOString()}
    `);

    const v2SessionKPI = {
      total: Number(v2SessionData[0]?.total || 0),
      running: Number(v2SessionData[0]?.running || 0),
      completed: Number(v2SessionData[0]?.completed || 0),
      failed: Number(v2SessionData[0]?.failed || 0),
    };

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
      // Stream 8 additions
      missionKPI,
      missionsPerDay,
      v2SessionKPI,
    });
  } catch (err: any) {
    await sqlClient.end();
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

