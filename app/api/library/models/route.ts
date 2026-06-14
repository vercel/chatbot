/**
 * GET /api/library/models — List all models with filtering and sorting.
 *
 * Query params:
 *   provider    — filter by provider slug (e.g. ?provider=anthropic)
 *   status      — filter by status (?status=active, default: active)
 *   capability  — filter by capability tag (?capability=vision)
 *   sort        — sort field (?sort=cost_score, default: display_name)
 *   order       — asc | desc (default: asc)
 *   search      — text search in display_name + identifier
 *
 * Cache: 1 hour via Cache-Control (models change rarely, updated via seed).
 */

import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

const POSTGRES_URL = process.env.POSTGRES_URL;

// Whitelist safe sort fields to prevent SQL injection
const ALLOWED_SORTS = new Set([
  "display_name", "provider", "context_window_tokens", "max_output_tokens",
  "input_price_per_million", "output_price_per_million",
  "reasoning_score", "coding_score", "vision_score", "speed_score", "cost_score",
  "created_at", "updated_at",
]);

// Whitelist safe sort order
const ALLOWED_ORDERS = new Set(["ASC", "DESC"]);

export async function GET(request: NextRequest) {
  if (!POSTGRES_URL) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const provider = searchParams.get("provider") || null;
  const statusFilter = searchParams.get("status") || "active";
  const capability = searchParams.get("capability") || null;
  const sort = ALLOWED_SORTS.has(searchParams.get("sort") ?? "") ? searchParams.get("sort")! : "display_name";
  const order = ALLOWED_ORDERS.has((searchParams.get("order") ?? "").toUpperCase())
    ? (searchParams.get("order")!.toUpperCase() as "ASC" | "DESC")
    : "ASC";
  const search = searchParams.get("search") || null;

  const sql = postgres(POSTGRES_URL, { max: 2 });

  try {
    const rows = await sql`
      SELECT * FROM "library_models"
      WHERE "status" = ${statusFilter}
        ${provider ? sql`AND "provider" = ${provider}` : sql``}
        ${capability ? sql`AND "capabilities" @> ${sql.json([capability])}` : sql``}
        ${search ? sql`AND ("display_name" ILIKE ${`%${search}%`} OR "identifier" ILIKE ${`%${search}%`})` : sql``}
      ORDER BY ${sql(sort)} ${sql.unsafe(order)}
    `;

    const models = (rows as Record<string, unknown>[]).map(serializeModel);

    // Compute summary counts
    const providers = new Set<string>();
    let activeCount = 0;
    for (const m of rows as Record<string, unknown>[]) {
      if (m.provider) providers.add(m.provider as string);
      if (m.status === "active") activeCount++;
    }

    return NextResponse.json(
      {
        models,
        summary: {
          total: models.length,
          active: activeCount,
          providers: providers.size,
          providerList: [...providers].sort(),
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      }
    );
  } catch (err) {
    console.error("[library/models]", err);
    return NextResponse.json({ error: "Model query failed" }, { status: 500 });
  } finally {
    await sql.end();
  }
}

function serializeModel(row: Record<string, unknown>) {
  return {
    identifier: row.identifier,
    displayName: row.display_name,
    provider: row.provider,
    family: row.family,
    version: row.version,
    releaseDate: row.release_date,
    contextWindowTokens: row.context_window_tokens,
    maxOutputTokens: row.max_output_tokens,
    inputPricePerMillion: typeof row.input_price_per_million === "string" ? parseFloat(row.input_price_per_million as string) : row.input_price_per_million,
    outputPricePerMillion: typeof row.output_price_per_million === "string" ? parseFloat(row.output_price_per_million as string) : row.output_price_per_million,
    cachedInputPrice: row.cached_input_price ? (typeof row.cached_input_price === "string" ? parseFloat(row.cached_input_price as string) : row.cached_input_price) : null,
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
  };
}
