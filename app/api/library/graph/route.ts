/**
 * GET /api/library/graph — Returns the full relational graph.
 *
 * Reads from library_* tables (populated by backfill-library-graph script).
 * Returns structured nodes + edges JSON for client-side visualization.
 *
 * Cache: 5-min ETag via Cache-Control (based on library_edges updated_at max).
 */
import { NextResponse } from "next/server";
import postgres from "postgres";
import { requireAllowlist } from "@/lib/auth/require-allowlist";

const POSTGRES_URL = process.env.POSTGRES_URL;

// ── Types ──────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  type: "connector" | "skill" | "function" | "playbook" | "workflow";
  name: string;
  label: string;
  metadata: Record<string, unknown>;
}

interface GraphEdge {
  id: string;
  from: string;
  fromType: string;
  to: string;
  toType: string;
  type: string;
  weight: number;
}

interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: {
    totalNodes: number;
    totalEdges: number;
    byType: Record<string, number>;
  };
}

// ── Handler ────────────────────────────────────────────────────────────────

export const GET = requireAllowlist(async (req: Request) => {
  if (!POSTGRES_URL) {
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const enrich = searchParams.get("enrich") === "usage";

  const sql = postgres(POSTGRES_URL, { max: 1 });

  try {
    const nodes: GraphNode[] = [];

    // Fetch connectors
    const connectors = await sql`
      SELECT "name", "description", "primary_domain", "also_in", "tools", "tool_names", "version"
      FROM "library_connectors"
      ORDER BY "name"
    `;

    for (const c of connectors) {
      nodes.push({
        id: `connector:${c.name}`,
        type: "connector",
        name: c.name,
        label: c.name.replace(/-connector$/, "").replace(/-/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
        metadata: {
          description: c.description,
          domain: c.primary_domain,
          alsoIn: c.also_in || [],
          tools: c.tools,
          toolNames: c.tool_names || [],
          version: c.version,
        },
      });
    }

    // Fetch skills
    const skills = await sql`
      SELECT "name", "type", "connector_name", "description", "version"
      FROM "library_skills"
      ORDER BY "type", "name"
    `;

    for (const s of skills) {
      nodes.push({
        id: `skill:${s.name}`,
        type: "skill",
        name: s.name,
        label: s.name.replace(/-/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
        metadata: {
          description: s.description,
          skillType: s.type,
          connectorName: s.connector_name,
          version: s.version,
        },
      });
    }

    // Fetch functions
    const functions = await sql`
      SELECT "name", "signature", "domain", "also_in", "dependencies", "version", "description"
      FROM "library_functions"
      ORDER BY "name"
    `;

    for (const f of functions) {
      nodes.push({
        id: `function:${f.name}`,
        type: "function",
        name: f.name,
        label: f.name.replace(/-/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
        metadata: {
          signature: f.signature,
          domain: f.domain,
          alsoIn: f.also_in || [],
          dependencies: f.dependencies || [],
          version: f.version,
          description: f.description,
        },
      });
    }

    // Fetch playbooks
    const playbooks = await sql`
      SELECT "name", "type", "scope_connectors", "triggers", "workflows", "description", "file_path"
      FROM "library_playbooks"
      ORDER BY "name"
    `;

    for (const p of playbooks) {
      nodes.push({
        id: `playbook:${p.name}`,
        type: "playbook",
        name: p.name,
        label: p.name.replace(/-/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
        metadata: {
          description: p.description,
          playbookType: p.type,
          scopeConnectors: p.scope_connectors || [],
          triggers: p.triggers || [],
          workflows: p.workflows || [],
          filePath: p.file_path,
        },
      });
    }

    // Fetch workflows
    const workflows = await sql`
      SELECT "name", "playbook_name", "durable", "description"
      FROM "library_workflows"
      ORDER BY "name"
    `;

    for (const w of workflows) {
      nodes.push({
        id: `workflow:${w.name}`,
        type: "workflow",
        name: w.name,
        label: w.name.replace(/-/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
        metadata: {
          description: w.description,
          playbookName: w.playbook_name,
          durable: w.durable,
        },
      });
    }

    // Fetch edges
    const dbEdges = await sql`
      SELECT "id", "from_node", "from_type", "to_node", "to_type", "edge_type", "weight"
      FROM "library_edges"
      ORDER BY "weight" DESC, "from_node"
    `;

    const edges: GraphEdge[] = dbEdges.map((e) => ({
      id: e.id,
      from: e.from_node,
      fromType: e.from_type,
      to: e.to_node,
      toType: e.to_type,
      type: e.edge_type,
      weight: e.weight,
    }));

    // Compute summary
    const byType: Record<string, number> = {};
    for (const n of nodes) {
      byType[n.type] = (byType[n.type] || 0) + 1;
    }

    const response: GraphResponse = {
      nodes,
      edges,
      summary: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        byType,
      },
    };

    // ── Enrichment: usage stats + recent items ─────────────────────────
    let usage: Record<string, unknown> = {};
    let recent: Array<Record<string, unknown>> = [];

    if (enrich) {
      // Usage aggregation — last 7 days
      const [usageRow] = await sql`
        SELECT
          COALESCE(SUM("tokens_actual"), 0) as tokens_this_week,
          COALESCE(SUM("cost_actual_usd"), 0) as cost_this_week,
          COALESCE(
            SUM(CASE WHEN "tokens_actual" > 0 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0),
            0
          ) as eval_pass_rate
        FROM "library_usage_logs"
        WHERE "created_at" >= NOW() - INTERVAL '7 days'
      `;

      usage = {
        tokensThisWeek: Number(usageRow?.tokens_this_week || 0),
        costThisWeek: Number(usageRow?.cost_this_week || 0),
        evalPassRate: Number(usageRow?.eval_pass_rate || 0),
        sparkline: [], // Daily breakdown — deferred to dedicated analytics endpoint
      };

      // Recent items — last 10 distinct viewed connectors/skills
      const recentRows = await sql`
        SELECT DISTINCT ON ("skill_loaded")
          "skill_loaded" as name,
          "skill_type" as type,
          "created_at" as viewed_at
        FROM "library_usage_logs"
        WHERE "created_at" >= NOW() - INTERVAL '30 days'
        ORDER BY "skill_loaded", "created_at" DESC
        LIMIT 10
      `;

      recent = recentRows.map((r) => ({
        type: r.type || "connector",
        name: r.name,
        label: (r.name || "").replace(/-/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
        viewedAt: r.viewed_at,
      }));
    }

    // ETag from max edge updated_at
    const [maxTs] = await sql`
      SELECT COALESCE(MAX("updated_at"), NOW()) as ts FROM "library_edges"
    `;
    const etag = `"${new Date(maxTs.ts).getTime().toString(36)}"`;

    const enrichedResponse = {
      ...response,
      ...(enrich ? { usage, recent } : {}),
    };

    return NextResponse.json(enrichedResponse, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
        ETag: etag,
      },
    });
  } catch (err) {
    console.error("[library/graph]", err);
    return NextResponse.json({ error: "Graph query failed" }, { status: 500 });
  } finally {
    await sql.end();
  }
});
