/**
 * GET /api/admin/function-inventory — Enterprise function map.
 *
 * Returns library_functions with connector/skill links and 7-day usage stats.
 *
 * Query params:
 *   ?search=text     — filter by function name/description/domain
 *   ?domain=billing  — filter by domain
 *   ?sort=calls|latency|name
 *   ?page=1          — pagination (50 per page)
 *   ?pageSize=100    — override (max 500, for CSV)
 */
import { NextResponse } from "next/server";
import postgres from "postgres";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

const POSTGRES_URL = process.env.POSTGRES_URL;

export const GET = requireAllowlist(async (req: Request) => {
  if (!POSTGRES_URL) {
    return NextResponse.json({ error: "DB not configured", rows: [], total: 0 }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const domain = searchParams.get("domain") || "";
  const sort = searchParams.get("sort") || "calls";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(500, Math.max(10, parseInt(searchParams.get("pageSize") || "50", 10)));
  const offset = (page - 1) * pageSize;

  const sql = postgres(POSTGRES_URL, { max: 1 });

  try {
    // ── Domains list ───────────────────────────────────────────────────
    const domainRows = await sql`
      SELECT DISTINCT "domain" FROM "library_functions"
      WHERE "domain" IS NOT NULL AND "domain" != ''
      ORDER BY "domain"
    `;

    // ── Main query with parameters ──────────────────────────────────────
    const searchPattern = search ? `%${search}%` : null;

    let sortSql: ReturnType<typeof sql>;
    switch (sort) {
      case "name":
        sortSql = sql`ORDER BY f."name" ASC`;
        break;
      case "latency":
        sortSql = sql`ORDER BY f."typical_latency_ms" DESC NULLS LAST, f."name" ASC`;
        break;
      default:
        sortSql = sql`ORDER BY f."name" ASC`;
    }

    // Build query dynamically based on presence of filters
    let functions;
    if (search && domain) {
      functions = await sql`
        SELECT
          f."name", f."signature", f."description", f."domain",
          f."skill_name", f."file_path", f."version",
          f."dependencies", f."also_in", f."context_tokens_estimated",
          f."typical_latency_ms", f."cost_per_invocation_usd",
          s."connector_name", s."description" as skill_description, s."type" as skill_type
        FROM "library_functions" f
        LEFT JOIN "library_skills" s ON s."name" = f."skill_name"
        WHERE f."domain" = ${domain}
          AND (f."name" ILIKE ${searchPattern}
            OR f."description" ILIKE ${searchPattern}
            OR f."signature" ILIKE ${searchPattern})
        ${sortSql}
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    } else if (search) {
      functions = await sql`
        SELECT
          f."name", f."signature", f."description", f."domain",
          f."skill_name", f."file_path", f."version",
          f."dependencies", f."also_in", f."context_tokens_estimated",
          f."typical_latency_ms", f."cost_per_invocation_usd",
          s."connector_name", s."description" as skill_description, s."type" as skill_type
        FROM "library_functions" f
        LEFT JOIN "library_skills" s ON s."name" = f."skill_name"
        WHERE f."name" ILIKE ${searchPattern}
           OR f."description" ILIKE ${searchPattern}
           OR f."signature" ILIKE ${searchPattern}
        ${sortSql}
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    } else if (domain) {
      functions = await sql`
        SELECT
          f."name", f."signature", f."description", f."domain",
          f."skill_name", f."file_path", f."version",
          f."dependencies", f."also_in", f."context_tokens_estimated",
          f."typical_latency_ms", f."cost_per_invocation_usd",
          s."connector_name", s."description" as skill_description, s."type" as skill_type
        FROM "library_functions" f
        LEFT JOIN "library_skills" s ON s."name" = f."skill_name"
        WHERE f."domain" = ${domain}
        ${sortSql}
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    } else {
      functions = await sql`
        SELECT
          f."name", f."signature", f."description", f."domain",
          f."skill_name", f."file_path", f."version",
          f."dependencies", f."also_in", f."context_tokens_estimated",
          f."typical_latency_ms", f."cost_per_invocation_usd",
          s."connector_name", s."description" as skill_description, s."type" as skill_type
        FROM "library_functions" f
        LEFT JOIN "library_skills" s ON s."name" = f."skill_name"
        ${sortSql}
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    }

    // ── Total count (separate efficient query) ──────────────────────────
    let countResult;
    if (search && domain) {
      countResult = await sql`
        SELECT COUNT(*)::int as total FROM "library_functions"
        WHERE "domain" = ${domain}
          AND ("name" ILIKE ${searchPattern}
            OR "description" ILIKE ${searchPattern}
            OR "signature" ILIKE ${searchPattern})
      `;
    } else if (search) {
      countResult = await sql`
        SELECT COUNT(*)::int as total FROM "library_functions"
        WHERE "name" ILIKE ${searchPattern}
           OR "description" ILIKE ${searchPattern}
           OR "signature" ILIKE ${searchPattern}
      `;
    } else if (domain) {
      countResult = await sql`
        SELECT COUNT(*)::int as total FROM "library_functions"
        WHERE "domain" = ${domain}
      `;
    } else {
      countResult = await sql`
        SELECT COUNT(*)::int as total FROM "library_functions"
      `;
    }
    const total = countResult[0]?.total || 0;

    // ── Usage stats (7-day window) ─────────────────────────────────────
    const funcNames = functions.map((f) => f.name);

    let usageRows: Array<{ skill_loaded: string; calls: number; avg_latency_ms: number | null }> = [];
    if (funcNames.length > 0) {
      usageRows = await sql`
        SELECT
          "skill_loaded",
          COUNT(*)::int as calls,
          ROUND(AVG("latency_actual_ms"))::int as avg_latency_ms
        FROM "library_usage_logs"
        WHERE "timestamp" >= NOW() - INTERVAL '7 days'
          AND "skill_loaded" = ANY(${funcNames})
        GROUP BY "skill_loaded"
      `;
    }

    const usageMap = new Map<string, { calls: number; avgLatencyMs: number | null }>();
    for (const stat of usageRows) {
      for (const fn of funcNames) {
        if (stat.skill_loaded?.includes(fn) || fn.includes(stat.skill_loaded)) {
          usageMap.set(fn, {
            calls: Number(stat.calls),
            avgLatencyMs: stat.avg_latency_ms ? Number(stat.avg_latency_ms) : null,
          });
          break;
        }
      }
    }

    // ── Build rows ──────────────────────────────────────────────────────
    const rows = functions.map((fn) => {
      const usage = usageMap.get(fn.name);
      const calls = usage?.calls ?? 0;
      const avgLatencyMs = usage?.avgLatencyMs ?? fn.typical_latency_ms ?? null;

      // Parse jsonb arrays
      let dependencies: string[] = [];
      let alsoIn: string[] = [];
      try { dependencies = typeof fn.dependencies === 'string' ? JSON.parse(fn.dependencies) : (fn.dependencies || []); } catch { dependencies = []; }
      try { alsoIn = typeof fn.also_in === 'string' ? JSON.parse(fn.also_in) : (fn.also_in || []); } catch { alsoIn = []; }

      return {
        function: fn.name,
        signature: fn.signature || "",
        description: fn.description || "",
        connector: fn.connector_name || fn.domain || "—",
        skill: fn.skill_name || "—",
        domain: fn.domain || "—",
        calls7d: calls,
        avgLatencyMs: avgLatencyMs ? Math.round(avgLatencyMs) : null,
        docStatus: (fn.description && fn.description.length > 10 ? "documented" : "minimal") as "documented" | "minimal",
        filePath: fn.file_path || "",
        version: fn.version || "1.0.0",
        dependencies,
        alsoIn,
        costPerInvocationUsd: fn.cost_per_invocation_usd,
      };
    });

    // Sort by usage if needed (can't do in SQL since usage is from separate table)
    if (sort === "calls") {
      rows.sort((a, b) => b.calls7d - a.calls7d);
    } else if (sort === "latency") {
      rows.sort((a, b) => (b.avgLatencyMs || 0) - (a.avgLatencyMs || 0));
    }

    return NextResponse.json({
      rows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      domains: domainRows.map((d) => d.domain),
    }, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
  } catch (err) {
    console.error("[function-inventory]", err);
    return NextResponse.json(
      { error: "Query failed", rows: [], total: 0, domains: [] },
      { status: 500 }
    );
  } finally {
    await sql.end();
  }
});
