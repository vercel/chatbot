// @ts-nocheck
/**
 * Phase 22.5: queryKnowledge — Self-Description Truth Tool
 *
 * Queries the library_* tables (populated by seed-library.ts from
 * system-capabilities.json) to answer questions about what the system
 * actually IS — not what training data hallucinates.
 *
 * Cardinal Rule: Call this BEFORE describing capabilities, playbooks,
 * connectors, functions, or any system entity. Never answer from memory.
 *
 * Uses Drizzle ORM against Postgres library_* tables.
 */

import { tool } from "ai";
import { z } from "zod";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import {
  libraryConnector,
  librarySkill,
  libraryFunction,
  libraryPlaybook,
  libraryWorkflow,
  libraryEdge,
} from "@/lib/db/schema";

const ENTITY_TYPES = [
  "connector",
  "skill",
  "function",
  "playbook",
  "workflow",
  "edge",
] as const;

// ── Result Types ──────────────────────────────────────────────────────────

interface KnowledgeEntity {
  id: string;
  type: string;
  name: string;
  label: string;
  metadata: Record<string, unknown>;
}

interface KnowledgeEdge {
  id: string;
  from: string;
  fromType: string;
  to: string;
  toType: string;
  type: string;
  weight: number;
  // Phase 24: Migration 0013 fields
  successCount?: number;
  failureCount?: number;
  confidenceScore?: number;
  lastUsedAt?: string;
  costPerUse?: number;
  latencyMsAvg?: number;
}

interface PlaybookIntentMatch {
  slug: string;
  confidence: number;
  source: string;
  evidence: string;
  similarIntents?: string[];
}

interface PastRunMatch {
  id: string;
  presetName: string;
  status: string;
  mode: string;
  promptPreview: string;
  createdAt: string;
  similarity: number;
}

interface OptimalPanelResult {
  presetId: string;
  presetName: string;
  totalRuns: number;
  successRate: number;
  avgLatencyMs: number;
  avgCost: number;
}

interface EnhancedKnowledgeResult {
  playbookMatches?: PlaybookIntentMatch[];
  connectors?: KnowledgeEntity[];
  pastRuns?: PastRunMatch[];
  optimalPanel?: OptimalPanelResult[];
  entities?: KnowledgeEntity[];
  edges?: KnowledgeEdge[];
  counts?: Record<string, number>;
}

interface KnowledgeResult {
  entities: KnowledgeEntity[];
  edges: KnowledgeEdge[];
  counts: {
    connectors: number;
    playbooks: number;
    skills: number;
    functions: number;
    workflows: number;
    edges: number;
    total: number;
  };
  query?: string;
  searchedTypes?: string[];
}

// ── DB helper ─────────────────────────────────────────────────────────────

function getDb() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL not configured");
  }
  return drizzle(postgres(process.env.POSTGRES_URL, { max: 1 }));
}

// ── Tool Definition ───────────────────────────────────────────────────────

export const queryKnowledge = tool({
  description: `Query the Knowledge Graph to find what connectors, playbooks, skills, functions, workflows and their relationships actually exist in this system.

CRITICAL: ALWAYS use this when describing system capabilities, answering "what can you do?", listing playbooks, or finding related entities. NEVER generate capability descriptions from memory — query this tool instead.

Use filters to narrow results:
- entity_type: "connector" | "skill" | "function" | "playbook" | "workflow" | "edge"
- name: exact or partial match
- domain: filter playbooks by domain
- related_to: find all entities connected to a given entity name

Examples:
- "What connectors exist?" → queryKnowledge({ entity_type: "connector" })
- "What does the billing playbook need?" → queryKnowledge({ name: "billing" })
- "What's connected to NMI?" → queryKnowledge({ related_to: "nmi" })`,

  inputSchema: z.object({
    queryType: z
      .enum([
        ...ENTITY_TYPES,
        "findPlaybooksByIntent",
        "findConnectorsByPlaybook",
        "findSimilarPastRuns",
        "findOptimalPanel",
      ] as const)
      .optional()
      .describe(
        "Query type: entity filters (connector|skill|function|playbook|workflow|edge) OR enhanced queries (findPlaybooksByIntent|findConnectorsByPlaybook|findSimilarPastRuns|findOptimalPanel)"
      ),
    entity_type: z
      .enum(ENTITY_TYPES)
      .optional()
      .describe("Filter to specific entity type (legacy, use queryType)"),
    name: z
      .string()
      .optional()
      .describe("Exact or partial name match"),
    domain: z
      .string()
      .optional()
      .describe("Filter playbooks by domain"),
    related_to: z
      .string()
      .optional()
      .describe("Find all entities connected to this entity name"),
    limit: z
      .number()
      .min(1)
      .max(100)
      .default(50)
      .describe("Max results to return"),
    // Phase 24: Enhanced query parameters
    intentText: z
      .string()
      .optional()
      .describe("User intent text for findPlaybooksByIntent"),
    playbookSlug: z
      .string()
      .optional()
      .describe("Playbook slug for findConnectorsByPlaybook"),
    promptText: z
      .string()
      .optional()
      .describe("Prompt text for findSimilarPastRuns (fuzzy match)"),
    intentType: z
      .string()
      .optional()
      .describe("Intent type for findOptimalPanel (e.g. 'billing', 'support')"),
    sessionId: z
      .string()
      .optional()
      .describe("Session ID for telemetry logging"),
  }),

  execute: async ({
    queryType,
    entity_type,
    name,
    domain,
    related_to,
    limit,
    intentText,
    playbookSlug,
    promptText,
    intentType,
    sessionId,
  }): Promise<KnowledgeResult | EnhancedKnowledgeResult> => {
    const result: KnowledgeResult = {
      entities: [],
      edges: [],
      counts: {
        connectors: 0,
        playbooks: 0,
        skills: 0,
        functions: 0,
        workflows: 0,
        edges: 0,
        total: 0,
      },
      query: name || entity_type || related_to || "all",
      searchedTypes: entity_type ? [entity_type] : undefined,
    };

    try {
      const db = getDb();

      // ── Phase 24: Enhanced Query Types ──────────────────────────────

      // findPlaybooksByIntent: Use KG router to find matching playbooks
      if (queryType === "findPlaybooksByIntent" && intentText) {
        const { routeIntent } = await import("@/lib/ai/routing/kg-router");
        const routing = await routeIntent(intentText, sessionId);
        return {
          playbookMatches: routing.matches.map((m) => ({
            slug: m.slug,
            confidence: m.confidence,
            source: m.source,
            evidence: m.evidence,
            similarIntents: m.similarIntents,
          })),
        };
      }

      // findConnectorsByPlaybook: Find connectors linked to a playbook
      if (queryType === "findConnectorsByPlaybook" && playbookSlug) {
        const edgeRows = await db.execute(sql`
          SELECT e.id, e.from_node, e.from_type, e.to_node, e.to_type,
                 e.edge_type, e.weight,
                 e.success_count, e.failure_count, e.confidence_score,
                 e.last_used_at, e.cost_per_use, e.latency_ms_avg
          FROM library_edges e
          WHERE e.from_type = 'playbook'
            AND e.from_node = ${playbookSlug}
            AND e.edge_type = 'uses'
          LIMIT ${limit}
        `);

        const connectorNames: string[] = [];
        const edges: KnowledgeEdge[] = [];
        for (const row of edgeRows.rows) {
          connectorNames.push(row.to_node as string);
          edges.push({
            id: row.id as string,
            from: row.from_node as string,
            fromType: row.from_type as string,
            to: row.to_node as string,
            toType: row.to_type as string,
            type: row.edge_type as string,
            weight: (row.weight as number) || 1,
            successCount: (row.success_count as number) || 0,
            failureCount: (row.failure_count as number) || 0,
            confidenceScore: (row.confidence_score as number) || 0.5,
            lastUsedAt: row.last_used_at as string | undefined,
            costPerUse: row.cost_per_use as number | undefined,
            latencyMsAvg: row.latency_ms_avg as number | undefined,
          });
        }

        // Fetch the connector entities
        let entities: KnowledgeEntity[] = [];
        if (connectorNames.length > 0) {
          const placeholders = connectorNames
            .map((_, i) => `$${i + 1}`)
            .join(", ");
          const connRows = await db.execute(
            sql.raw(
              `SELECT * FROM library_connectors WHERE name IN (${placeholders})`,
              ...connectorNames
            )
          );

          // Can't easily use parameterized IN clauses with drizzle sql template,
          // so fetch all matching connectors individually
          for (const name of connectorNames) {
            const matchRows = await db.execute(sql`
              SELECT * FROM library_connectors WHERE name = ${name} LIMIT 1
            `);
            for (const r of matchRows.rows) {
              entities.push({
                id: `connector:${r.name}`,
                type: "connector",
                name: r.name as string,
                label: (r.name as string)
                  .replace(/-/g, " ")
                  .replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
                metadata: {
                  description: r.description as string,
                  mcpEnabled: r.mcp_enabled as boolean,
                  tools: r.tools as number,
                  toolNames: r.tool_names as string[],
                  alsoIn: r.also_in as string[],
                  domain: r.primary_domain as string,
                },
              });
            }
          }
        }

        return { connectors: entities, edges };
      }

      // findSimilarPastRuns: Fuzzy match on prompt text
      if (queryType === "findSimilarPastRuns" && promptText) {
        const searchTerms = promptText
          .split(/\s+/)
          .filter((t) => t.length > 2)
          .map((t) => t.replace(/[%_]/g, "\\$&"))
          .slice(0, 5);

        const pastRuns: PastRunMatch[] = [];

        // Query panel runs with LIKE matching
        if (searchTerms.length > 0) {
          const likeConditions = searchTerms
            .map((term) => `ta_text ILIKE '%${term}%'`)
            .join(" OR ");

          const runRows = await db.execute(sql.raw(`
            SELECT pr.id, pr.preset_name, pr.status, pr.execution_mode,
                   pr.task_analysis->>'reasoning' AS ta_text,
                   pr.created_at
            FROM library_panel_runs pr
            WHERE pr.task_analysis IS NOT NULL
              AND (${likeConditions})
            ORDER BY pr.created_at DESC
            LIMIT ${limit}
          `));

          for (const row of runRows.rows) {
            const taText = (row.ta_text as string) || "";
            const similarity = searchTerms.filter((t) =>
              taText.toLowerCase().includes(t.toLowerCase())
            ).length / searchTerms.length;

            pastRuns.push({
              id: row.id as string,
              presetName: row.preset_name as string,
              status: row.status as string,
              mode: row.execution_mode as string,
              promptPreview: taText.slice(0, 200),
              createdAt: row.created_at as string,
              similarity,
            });
          }
        }

        // Also query playbook usage for similar intents
        if (searchTerms.length > 0) {
          const usageRows = await db.execute(sql`
            SELECT id::text, playbook_slug, intent_text, success, created_at
            FROM library_playbook_usage
            WHERE intent_text IS NOT NULL
            ORDER BY created_at DESC
            LIMIT ${limit}
          `);

          for (const row of usageRows.rows) {
            const intent = (row.intent_text as string) || "";
            const similarity = searchTerms.filter((t) =>
              intent.toLowerCase().includes(t.toLowerCase())
            ).length / searchTerms.length;

            if (similarity > 0.1) {
              pastRuns.push({
                id: `usage:${row.id}`,
                presetName: row.playbook_slug as string,
                status: row.success ? "success" : "failed",
                mode: "playbook_usage",
                promptPreview: intent.slice(0, 200),
                createdAt: row.created_at as string,
                similarity,
              });
            }
          }
        }

        // Sort by similarity descending
        pastRuns.sort((a, b) => b.similarity - a.similarity);

        return { pastRuns: pastRuns.slice(0, limit) };
      }

      // findOptimalPanel: Find best panel preset by success rate
      if (queryType === "findOptimalPanel") {
        const runRows = await db.execute(sql`
          SELECT
            pr.preset_id,
            pr.preset_name,
            COUNT(*) AS total_runs,
            SUM(CASE WHEN pr.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
            SUM(CASE WHEN pr.status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
            AVG(pr.total_latency_ms) AS avg_latency_ms,
            AVG(pr.total_cost) AS avg_cost
          FROM library_panel_runs pr
          WHERE pr.preset_id IS NOT NULL
            ${intentType ? sql`AND pr.execution_mode = ${intentType}` : sql``}
          GROUP BY pr.preset_id, pr.preset_name
          ORDER BY
            CASE WHEN COUNT(*) > 0
              THEN SUM(CASE WHEN pr.status = 'completed' THEN 1 ELSE 0 END)::float / COUNT(*)
              ELSE 0
            END DESC
          LIMIT ${limit}
        `);

        const optimalPanels: OptimalPanelResult[] = [];
        for (const row of runRows.rows) {
          const total = (row.total_runs as number) || 0;
          const completed = (row.completed_count as number) || 0;
          optimalPanels.push({
            presetId: row.preset_id as string,
            presetName: row.preset_name as string,
            totalRuns: total,
            successRate: total > 0 ? completed / total : 0,
            avgLatencyMs: (row.avg_latency_ms as number) || 0,
            avgCost: (row.avg_cost as number) || 0,
          });
        }

        return { optimalPanel: optimalPanels };
      }

      // ── Existing entity queries ────────────────────────────────────────
      const entities: KnowledgeEntity[] = [];
      const edges: KnowledgeEdge[] = [];

      // ── Fetch connectors ─────────────────────────────────────────────
      if (!entity_type || entity_type === "connector") {
        const rows = await db
          .select()
          .from(libraryConnector)
          .where(
            name
              ? sql`${libraryConnector.name} ILIKE ${"%" + name + "%"}`
              : undefined
          )
          .limit(limit);

        for (const r of rows) {
          entities.push({
            id: `connector:${r.name}`,
            type: "connector",
            name: r.name,
            label: r.name.replace(/-/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
            metadata: {
              description: r.description,
              mcpEnabled: r.mcpEnabled,
              tools: r.tools,
              toolNames: r.toolNames,
              alsoIn: r.alsoIn,
              domain: r.primaryDomain,
            },
          });
        }
      }

      // ── Fetch skills ─────────────────────────────────────────────────
      if (!entity_type || entity_type === "skill") {
        const rows = await db
          .select()
          .from(librarySkill)
          .where(
            name
              ? sql`${librarySkill.name} ILIKE ${"%" + name + "%"}`
              : undefined
          )
          .limit(limit);

        for (const r of rows) {
          entities.push({
            id: `skill:${r.name}`,
            type: "skill",
            name: r.name,
            label: r.name.replace(/-/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
            metadata: {
              description: r.description,
              skillType: r.type,
              connectorName: r.connectorName,
            },
          });
        }
      }

      // ── Fetch functions ──────────────────────────────────────────────
      if (!entity_type || entity_type === "function") {
        const rows = await db
          .select()
          .from(libraryFunction)
          .where(
            name
              ? sql`${libraryFunction.name} ILIKE ${"%" + name + "%"}`
              : undefined
          )
          .limit(limit);

        for (const r of rows) {
          entities.push({
            id: `function:${r.name}`,
            type: "function",
            name: r.name,
            label: r.name.replace(/-/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
            metadata: {
              signature: r.signature,
              description: r.description,
              domain: r.domain,
            },
          });
        }
      }

      // ── Fetch playbooks ──────────────────────────────────────────────
      if (!entity_type || entity_type === "playbook") {
        const rows = await db
          .select()
          .from(libraryPlaybook)
          .where(
            name
              ? sql`${libraryPlaybook.name} ILIKE ${"%" + name + "%"}`
              : undefined
          )
          .limit(limit);

        for (const r of rows) {
          entities.push({
            id: `playbook:${r.name}`,
            type: "playbook",
            name: r.name,
            label: r.name.replace(/-/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
            metadata: {
              description: r.description,
              playbookType: r.type,
              scopeConnectors: r.scopeConnectors,
              workflows: r.workflows,
              triggers: r.triggers,
            },
          });
        }
      }

      // ── Fetch workflows ──────────────────────────────────────────────
      if (!entity_type || entity_type === "workflow") {
        const rows = await db
          .select()
          .from(libraryWorkflow)
          .where(
            name
              ? sql`${libraryWorkflow.name} ILIKE ${"%" + name + "%"}`
              : undefined
          )
          .limit(limit);

        for (const r of rows) {
          entities.push({
            id: `workflow:${r.name}`,
            type: "workflow",
            name: r.name,
            label: r.name.replace(/-/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
            metadata: {
              description: r.description,
              playbookName: r.playbookName,
              durable: r.durable,
            },
          });
        }
      }

      // ── Fetch edges ──────────────────────────────────────────────────
      if (!entity_type || entity_type === "edge" || related_to) {
        let edgeRows;
        if (related_to) {
          edgeRows = await db
            .select()
            .from(libraryEdge)
            .where(
              sql`(${libraryEdge.fromNode} ILIKE ${"%" + related_to + "%"} OR ${libraryEdge.toNode} ILIKE ${"%" + related_to + "%"})`
            )
            .limit(limit);
        } else if (!entity_type || entity_type === "edge") {
          edgeRows = await db
            .select()
            .from(libraryEdge)
            .limit(limit);
        } else {
          // Filter edges by entity type
          edgeRows = await db
            .select()
            .from(libraryEdge)
            .where(
              sql`(${libraryEdge.fromType} = ${entity_type} OR ${libraryEdge.toType} = ${entity_type})`
            )
            .limit(limit);
        }

        for (const e of (edgeRows || [])) {
          edges.push({
            id: e.id,
            from: e.fromNode,
            fromType: e.fromType,
            to: e.toNode,
            toType: e.toType,
            type: e.edgeType,
            weight: e.weight,
          });
        }
      }

      // ── Fetch counts ─────────────────────────────────────────────────
      const [connCount] = await db.select({ count: sql<number>`count(*)` }).from(libraryConnector);
      const [pbCount] = await db.select({ count: sql<number>`count(*)` }).from(libraryPlaybook);
      const [skillCount] = await db.select({ count: sql<number>`count(*)` }).from(librarySkill);
      const [funcCount] = await db.select({ count: sql<number>`count(*)` }).from(libraryFunction);
      const [wfCount] = await db.select({ count: sql<number>`count(*)` }).from(libraryWorkflow);
      const [edgeCount] = await db.select({ count: sql<number>`count(*)` }).from(libraryEdge);

      result.counts = {
        connectors: connCount?.count ?? 0,
        playbooks: pbCount?.count ?? 0,
        skills: skillCount?.count ?? 0,
        functions: funcCount?.count ?? 0,
        workflows: wfCount?.count ?? 0,
        edges: edgeCount?.count ?? 0,
        total:
          (connCount?.count ?? 0) +
          (pbCount?.count ?? 0) +
          (skillCount?.count ?? 0) +
          (funcCount?.count ?? 0) +
          (wfCount?.count ?? 0),
      };

      result.entities = entities.slice(0, limit);
      result.edges = edges.slice(0, limit);

      return result;
    } catch (err) {
      console.error("[queryKnowledge] Error:", (err as Error).message);
      // Return partial results on error — better than hallucinations
      return result;
    }
  },
});

export { ENTITY_TYPES };
