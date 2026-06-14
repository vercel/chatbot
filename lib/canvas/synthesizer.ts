/**
 * lib/canvas/synthesizer.ts — Merges DB + filesystem MD + edges +
 * usage_logs + KG neighbors into a unified SynthesisResponse.
 *
 * Phase 16.C: Single source of truth synthesis pipeline.
 *
 * Design:
 *  1. Fetch base record from library_* table
 *  2. Read MD content from filesystem (file_path)
 *  3. Query library_edges for reverse references
 *  4. Aggregate library_usage_logs for usage metrics
 *  5. Query KG neighbors (edges going out from this node)
 *  6. Merge into unified SynthesisResponse
 */

import postgres from "postgres";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { SynthesisResponse, GraphEdge, GraphNode } from "@/lib/canvas/types";

const POSTGRES_URL = process.env.POSTGRES_URL;
const REPO_ROOT = process.env.NEPTUNE_REPO_ROOT || "/home/neptune/playbook-os";

// ── LRU Cache ─────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: SynthesisResponse;
  ts: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(key: string): SynthesisResponse | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: SynthesisResponse): void {
  // LRU: if cache exceeds 50 entries, evict oldest
  if (cache.size >= 50) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { data, ts: Date.now() });
}

// ── Main Synthesizer ─────────────────────────────────────────────────────────

export async function synthesize(
  type: string,
  name: string,
): Promise<SynthesisResponse> {
  const cacheKey = `${type}:${name}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  if (!POSTGRES_URL) {
    throw new Error("Database not configured");
  }

  const sql = postgres(POSTGRES_URL, { max: 1 });

  try {
    const result = await buildSynthesis(sql, type, name);
    setCache(cacheKey, result);
    return result;
  } finally {
    await sql.end();
  }
}

// ── Build Synthesis ──────────────────────────────────────────────────────────

async function buildSynthesis(
  sql: postgres.Sql,
  type: string,
  name: string,
): Promise<SynthesisResponse> {
  // ── 1. Fetch base record ──────────────────────────────────────────
  let meta: SynthesisResponse["meta"] = { type, name };
  let markdown = "";
  let filePath = "";

  switch (type) {
    case "connector": {
      const [row] = await sql`
        SELECT "name", "description", "primary_domain", "version", "file_path"
        FROM "library_connectors"
        WHERE "name" = ${name}
      `;
      if (row) {
        meta = {
          type: "connector",
          name: row.name,
          version: row.version,
          lastUpdated: undefined,
        };
        markdown = row.description || "";
        filePath = row.file_path || "";
      }
      break;
    }
    case "skill": {
      const [row] = await sql`
        SELECT "name", "description", "version", "file_path"
        FROM "library_skills"
        WHERE "name" = ${name}
      `;
      if (row) {
        meta = { type: "skill", name: row.name, version: row.version };
        markdown = row.description || "";
        filePath = row.file_path || "";
      }
      break;
    }
    case "function": {
      const [row] = await sql`
        SELECT "name", "signature", "description", "version", "constraints"
        FROM "library_functions"
        WHERE "name" = ${name}
      `;
      if (row) {
        meta = { type: "function", name: row.name, version: row.version };
        markdown = row.description || "";
      }
      break;
    }
    case "playbook": {
      const [row] = await sql`
        SELECT "name", "description", "file_path", "triggers"
        FROM "library_playbooks"
        WHERE "name" = ${name}
      `;
      if (row) {
        meta = { type: "playbook", name: row.name };
        markdown = row.description || "";
        filePath = row.file_path || "";
      }
      break;
    }
    case "wiki": {
      // Wiki is filesystem-only — no DB table
      meta = { type: "wiki", name };
      break;
    }
    default:
      break;
  }

  // ── 2. Read filesystem MD ─────────────────────────────────────────
  if (filePath) {
    try {
      const fullPath = join(REPO_ROOT, filePath);
      if (existsSync(fullPath)) {
        const md = await readFile(fullPath, "utf-8");
        if (md) markdown = md;
      }
    } catch {
      // File not found — use DB description
    }
  }

  // For wiki type, try reading from known wiki paths
  if (type === "wiki") {
    const wikiPaths = [
      join(REPO_ROOT, "docs", `${name}.md`),
      join(REPO_ROOT, "wiki", `${name}.md`),
      join(REPO_ROOT, "domains", name, "README.md"),
    ];
    for (const p of wikiPaths) {
      try {
        if (existsSync(p)) {
          markdown = await readFile(p, "utf-8");
          break;
        }
      } catch { /* continue */ }
    }
  }

  // ── 3. Parse sections ─────────────────────────────────────────────
  const sections = parseSections(markdown);

  // ── 4. Reverse references from library_edges ──────────────────────
  const nodeId = `${type}:${name}`;
  const reverseEdges = await sql`
    SELECT "from_node", "from_type", "to_node", "to_type", "edge_type", "weight"
    FROM "library_edges"
    WHERE "to_node" = ${nodeId}
    ORDER BY "weight" DESC
  `;

  const reverseRefs: SynthesisResponse["reverseRefs"] = {
    playbooks: [] as string[],
    workflows: [] as string[],
    skills: [] as string[],
    functions: [] as string[],
  };

  for (const e of reverseEdges) {
    const fromName = e.from_node.replace(/^[^:]+:/, "");
    switch (e.from_type) {
      case "playbook":
        reverseRefs.playbooks.push(fromName);
        break;
      case "workflow":
        reverseRefs.workflows.push(fromName);
        break;
      case "skill":
        reverseRefs.skills.push(fromName);
        break;
      case "function":
        reverseRefs.functions.push(fromName);
        break;
    }
  }

  // Deduplicate
  for (const k of Object.keys(reverseRefs) as Array<keyof typeof reverseRefs>) {
    reverseRefs[k] = [...new Set(reverseRefs[k])];
  }

  // ── 5. All edges (outgoing) ───────────────────────────────────────
  const allEdges = await sql`
    SELECT "id", "from_node", "from_type", "to_node", "to_type", "edge_type", "weight"
    FROM "library_edges"
    WHERE "from_node" = ${nodeId}
    ORDER BY "weight" DESC
  `;

  const edges: GraphEdge[] = allEdges.map((e) => ({
    id: e.id,
    from: e.from_node,
    fromType: e.from_type,
    to: e.to_node,
    toType: e.to_type,
    type: e.edge_type,
    weight: e.weight,
  }));

  // ── 6. Usage stats ────────────────────────────────────────────────
  const [usageRow] = await sql`
    SELECT
      COALESCE(SUM("tokens_actual"), 0) as total_tokens,
      COALESCE(SUM("cost_actual_usd"), 0) as total_cost,
      COUNT(*) as total_calls,
      COALESCE(
        SUM(CASE WHEN "tokens_actual" > 0 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0),
        0
      ) as success_rate
    FROM "library_usage_logs"
    WHERE "skill_loaded" = ${type === "skill" ? name : "%"}
      AND "created_at" >= NOW() - INTERVAL '7 days'
  `;

  const usage: SynthesisResponse["usage"] = {
    last7d: {
      tokens: Number(usageRow?.total_tokens || 0),
      cost: Number(usageRow?.total_cost || 0),
      calls: Number(usageRow?.total_calls || 0),
      successRate: Number(usageRow?.success_rate || 0),
    },
    sparkline: [], // Populated by enriched graph endpoint
  };

  // ── 7. KG Neighbors ───────────────────────────────────────────────
  const neighborIds = new Set<string>();
  for (const e of edges) neighborIds.add(e.to);

  const kgNeighbors: GraphNode[] = [];
  if (neighborIds.size > 0) {
    // Look up each neighbor from the graph endpoint data
    // This is a simplified version — full implementation queries each table
    for (const nid of neighborIds) {
      const [nType, nName] = nid.split(":");
      if (!nType || !nName) continue;
      kgNeighbors.push({
        id: nid,
        type: nType as GraphNode["type"],
        name: nName,
        label: nName.replace(/-/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()),
        metadata: {},
      });
    }
  }

  // ── 8. Wiki refs ──────────────────────────────────────────────────
  const wikiRefs: SynthesisResponse["wikiRefs"] = [];
  // Extract wiki links from markdown
  const wikiLinkPattern = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
  let match;
  while ((match = wikiLinkPattern.exec(markdown)) !== null) {
    wikiRefs.push({
      path: match[2],
      title: match[1],
      snippet: "",
    });
  }

  // ── 9. Constraints (for skills/functions) ─────────────────────────
  let constraints: SynthesisResponse["constraints"];
  if (type === "skill") {
    const [skillRow] = await sql`
      SELECT "constraints" FROM "library_skills" WHERE "name" = ${name}
    `;
    if (skillRow?.constraints) {
      constraints = skillRow.constraints as SynthesisResponse["constraints"];
    }
  }

  // ── 10. Signatures (for functions) ─────────────────────────────────
  let signatures: SynthesisResponse["signatures"];
  if (type === "function") {
    const [fnRow] = await sql`
      SELECT "signature" FROM "library_functions" WHERE "name" = ${name}
    `;
    if (fnRow?.signature) {
      signatures = {
        input: { signature: fnRow.signature },
        output: { returns: "unknown" },
      };
    }
  }

  // ── 11. Triggers + Model Routing (for playbooks) ───────────────────
  let triggers: string[] | undefined;
  let modelRouting: Record<string, string> | undefined;
  if (type === "playbook") {
    const [pbRow] = await sql`
      SELECT "triggers", "scope_connectors"
      FROM "library_playbooks"
      WHERE "name" = ${name}
    `;
    if (pbRow) {
      triggers = pbRow.triggers || [];
    }
  }

  return {
    meta,
    markdown,
    sections,
    reverseRefs,
    edges,
    usage,
    kgNeighbors,
    wikiRefs,
    constraints,
    signatures,
    triggers,
    modelRouting,
  };
}

// ── Section Parser ───────────────────────────────────────────────────────────

function parseSections(
  md: string,
): Array<{ id: string; title: string; content: string }> {
  const sections: Array<{ id: string; title: string; content: string }> = [];
  const lines = md.split("\n");
  let currentSection: { id: string; title: string; content: string } | null =
    null;

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)/);
    const h1Match = line.match(/^#\s+(.+)/);

    if (h2Match || h1Match) {
      if (currentSection) {
        sections.push(currentSection);
      }
      const title = (h2Match || h1Match)![1].trim();
      currentSection = {
        id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title,
        content: "",
      };
    } else if (currentSection) {
      currentSection.content += line + "\n";
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  // If no headings found, return single section
  if (sections.length === 0 && md.trim()) {
    sections.push({
      id: "content",
      title: "Content",
      content: md,
    });
  }

  return sections;
}
