/**
 * POST /api/knowledge/backfill
 *
 * Triggers KG backfill from all GRAPH-TAG.json files.
 * Reads all GRAPH-TAG.json files from connectors and playbooks,
 * upserts entities + relations into library_entities and library_relations.
 *
 * Designed for cron-driven daily backfill.
 */
import { NextResponse } from "next/server";
import { backfillGraphTags } from "@/lib/knowledge/backfill-graph-tags";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

export const maxDuration = 60;

export const POST = requireAllowlist(async (_req: Request) => {
  try {
    const result = await backfillGraphTags();

    return NextResponse.json(result, {
      status: result.success ? 200 : 207,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        processedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
});

/**
 * GET /api/knowledge/backfill
 * Returns backfill status without executing (read-only).
 */
export const GET = requireAllowlist(async (_req: Request) => {
  try {
    const sql = (await import("@/lib/knowledge/backfill-graph-tags")).getKgSql();

    const entityCount = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int as count FROM library_entities
    `;
    const relationCount = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int as count FROM library_relations
    `;
    const connectorCount = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int as count FROM library_entities WHERE type = 'Connector'
    `;
    const lastBackfill = await sql<{ updated_at: string }[]>`
      SELECT MAX(updated_at) as updated_at FROM library_entities
    `;

    return NextResponse.json({
      status: "ok",
      entities: entityCount[0]?.count || 0,
      relations: relationCount[0]?.count || 0,
      connectors: connectorCount[0]?.count || 0,
      lastBackfill: lastBackfill[0]?.updated_at || null,
      expectedConnectors: 15,
      healthy:
        (connectorCount[0]?.count || 0) >= 13,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
});
