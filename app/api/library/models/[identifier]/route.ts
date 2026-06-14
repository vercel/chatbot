/**
 * GET /api/library/models/[identifier] — Get a single model by identifier.
 *
 * Example: GET /api/library/models/anthropic%2Fclaude-sonnet-4-6
 *          GET /api/library/models/deepseek%2Fdeepseek-v4-pro
 *
 * Cache: 1 hour via Cache-Control.
 */

import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

const POSTGRES_URL = process.env.POSTGRES_URL;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  if (!POSTGRES_URL) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  const { identifier } = await params;
  const decoded = decodeURIComponent(identifier);
  const sql = postgres(POSTGRES_URL, { max: 2 });

  try {
    const [row] = await sql`
      SELECT * FROM "library_models"
      WHERE "identifier" = ${decoded}
      LIMIT 1
    `;

    if (!row) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    // Also fetch recent usage stats for this model
    const [usageStats] = await sql`
      SELECT
        COUNT(*)::int as total_calls,
        COALESCE(AVG("latency_ms"), 0)::int as avg_latency_ms,
        COALESCE(SUM("tokens_in"), 0)::bigint as total_tokens_in,
        COALESCE(SUM("tokens_out"), 0)::bigint as total_tokens_out,
        COALESCE(SUM("cost_usd"), 0)::numeric as total_cost_usd
      FROM "library_model_usage_logs"
      WHERE "model_used" = ${decoded}
        AND "timestamp" > now() - interval '7 days'
    `;

    const model = {
      identifier: row.identifier,
      displayName: row.display_name,
      provider: row.provider,
      family: row.family,
      version: row.version,
      releaseDate: row.release_date,
      contextWindowTokens: row.context_window_tokens,
      maxOutputTokens: row.max_output_tokens,
      inputPricePerMillion: typeof row.input_price_per_million === "string" ? parseFloat(row.input_price_per_million) : row.input_price_per_million,
      outputPricePerMillion: typeof row.output_price_per_million === "string" ? parseFloat(row.output_price_per_million) : row.output_price_per_million,
      cachedInputPrice: row.cached_input_price ? (typeof row.cached_input_price === "string" ? parseFloat(row.cached_input_price) : row.cached_input_price) : null,
      capabilities: row.capabilities || [],
      modalities: row.modalities || [],
      reasoningScore: row.reasoning_score,
      codingScore: row.coding_score,
      visionScore: row.vision_score,
      speedScore: row.speed_score,
      costScore: row.cost_score,
      benchmarkScores: row.benchmark_scores || null,
      bestFor: row.best_for || [],
      notGoodFor: row.not_good_for || [],
      status: row.status,
      sourceUrl: row.source_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Usage stats (last 7 days)
      usage: {
        totalCalls: usageStats?.total_calls ?? 0,
        avgLatencyMs: usageStats?.avg_latency_ms ?? 0,
        totalTokensIn: Number(usageStats?.total_tokens_in ?? 0),
        totalTokensOut: Number(usageStats?.total_tokens_out ?? 0),
        totalCostUsd: usageStats?.total_cost_usd ? parseFloat(usageStats.total_cost_usd) : 0,
      },
    };

    return NextResponse.json(model, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    console.error("[library/models/[identifier]]", err);
    return NextResponse.json({ error: "Model query failed" }, { status: 500 });
  } finally {
    await sql.end();
  }
}
