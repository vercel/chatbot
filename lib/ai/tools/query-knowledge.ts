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
    entity_type: z
      .enum(ENTITY_TYPES)
      .optional()
      .describe("Filter to specific entity type"),
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
  }),

  execute: async ({ entity_type, name, domain, related_to, limit }): Promise<KnowledgeResult> => {
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
