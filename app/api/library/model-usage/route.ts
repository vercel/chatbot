/**
 * POST /api/library/model-usage — Log a model usage event.
 *
 * Body: {
 *   sessionId?: string;
 *   modelUsed: string;
 *   playbookRoutedFrom?: string;
 *   skillRoutedTo?: string;
 *   tokensIn?: number;
 *   tokensOut?: number;
 *   latencyMs?: number;
 *   costUsd?: number;
 *   successMarker?: boolean;
 *   userRating?: number;
 * }
 *
 * GET /api/library/model-usage — Query recent usage (last 24h).
 *   Query params:
 *     sessionId  — filter by session
 *     modelUsed  — filter by model
 *     limit      — max results (default: 50)
 */

import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { z } from "zod";

const POSTGRES_URL = process.env.POSTGRES_URL;

const postBodySchema = z.object({
  sessionId: z.string().optional(),
  modelUsed: z.string().min(1),
  playbookRoutedFrom: z.string().optional(),
  skillRoutedTo: z.string().optional(),
  tokensIn: z.number().int().positive().optional(),
  tokensOut: z.number().int().positive().optional(),
  latencyMs: z.number().int().positive().optional(),
  costUsd: z.number().positive().optional(),
  successMarker: z.boolean().optional().default(true),
  userRating: z.number().int().min(0).max(5).optional().default(0),
});

export async function POST(request: NextRequest) {
  if (!POSTGRES_URL) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    sessionId,
    modelUsed,
    playbookRoutedFrom,
    skillRoutedTo,
    tokensIn,
    tokensOut,
    latencyMs,
    costUsd,
    successMarker,
    userRating,
  } = parsed.data;

  const sql = postgres(POSTGRES_URL, { max: 2 });

  try {
    const [row] = await sql`
      INSERT INTO "library_model_usage_logs" (
        "session_id", "model_used", "playbook_routed_from", "skill_routed_to",
        "tokens_in", "tokens_out", "latency_ms", "cost_usd",
        "success_marker", "user_rating"
      ) VALUES (
        ${sessionId ?? null},
        ${modelUsed},
        ${playbookRoutedFrom ?? null},
        ${skillRoutedTo ?? null},
        ${tokensIn ?? null},
        ${tokensOut ?? null},
        ${latencyMs ?? null},
        ${costUsd ? String(costUsd) : null},
        ${successMarker},
        ${userRating}
      )
      RETURNING "id"
    `;

    return NextResponse.json({ id: row.id, logged: true }, { status: 201 });
  } catch (err) {
    console.error("[library/model-usage] POST:", err);
    return NextResponse.json({ error: "Log insert failed" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

export async function GET(request: NextRequest) {
  if (!POSTGRES_URL) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const sessionId = searchParams.get("sessionId") || null;
  const modelUsed = searchParams.get("modelUsed") || null;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);

  const sql = postgres(POSTGRES_URL, { max: 2 });

  try {
    const rows = await sql`
      SELECT * FROM "library_model_usage_logs"
      WHERE "timestamp" > now() - interval '24 hours'
        ${sessionId ? sql`AND "session_id" = ${sessionId}` : sql``}
        ${modelUsed ? sql`AND "model_used" = ${modelUsed}` : sql``}
      ORDER BY "timestamp" DESC
      LIMIT ${limit}
    `;

    const logs = (rows as Record<string, unknown>[]).map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      modelUsed: r.model_used,
      playbookRoutedFrom: r.playbook_routed_from,
      skillRoutedTo: r.skill_routed_to,
      tokensIn: r.tokens_in,
      tokensOut: r.tokens_out,
      latencyMs: r.latency_ms,
      costUsd: r.cost_usd ? parseFloat(r.cost_usd as string) : null,
      successMarker: r.success_marker,
      userRating: r.user_rating,
      timestamp: r.timestamp,
    }));

    // Aggregate summary
    const [summary] = await sql`
      SELECT
        COUNT(*)::int as total_calls,
        COUNT(DISTINCT "model_used")::int as unique_models,
        COALESCE(SUM("tokens_in"), 0)::bigint as total_tokens_in,
        COALESCE(SUM("tokens_out"), 0)::bigint as total_tokens_out,
        COALESCE(SUM("cost_usd"), 0)::numeric as total_cost_usd
      FROM "library_model_usage_logs"
      WHERE "timestamp" > now() - interval '24 hours'
        ${sessionId ? sql`AND "session_id" = ${sessionId}` : sql``}
        ${modelUsed ? sql`AND "model_used" = ${modelUsed}` : sql``}
    `;

    return NextResponse.json({
      logs,
      summary: {
        totalCalls: summary?.total_calls ?? 0,
        uniqueModels: summary?.unique_models ?? 0,
        totalTokensIn: Number(summary?.total_tokens_in ?? 0),
        totalTokensOut: Number(summary?.total_tokens_out ?? 0),
        totalCostUsd: summary?.total_cost_usd ? parseFloat(summary.total_cost_usd) : 0,
      },
    }, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30",
      },
    });
  } catch (err) {
    console.error("[library/model-usage] GET:", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
