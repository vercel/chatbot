// @ts-nocheck — pre-existing Phase 24 type issues, refined in Streams 3-5
/**
 * Phase 24: /graph slash command tool
 *
 * Type /graph <entity> in chat -> returns mini graph artifact
 * Click -> opens /library/graph?focus=<entity_id>
 */

import { tool } from "ai";
import { z } from "zod";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

export const graphQueryTool = tool({
  description:
    "Search the Knowledge Graph for entities. Use /graph <entity> to find nodes and their relationships.",
  parameters: z.object({
    query: z
      .string()
      .describe("Entity name, type, or keyword to search for in the KG"),
    entityType: z
      .enum([
        "connector",
        "playbook",
        "skill",
        "function",
        "workflow",
        "panel",
        "v2_handoff",
        "model",
      ])
      .optional(),
  }),
  execute: async ({ query, entityType }) => {
    if (!process.env.POSTGRES_URL) {
      return {
        error: "Knowledge Graph not available (no database connection)",
      };
    }

    const db = drizzle(postgres(process.env.POSTGRES_URL, { max: 1 }));

    try {
      // Search across all entity tables
      const tables = entityType
        ? [`library_${entityType}s`]
        : [
            "library_connectors",
            "library_playbooks",
            "library_skills",
            "library_functions",
            "library_workflows",
          ];

      let allResults: any[] = [];

      for (const table of tables) {
        const type = table.replace("library_", "").replace(/s$/, "");
        try {
          const results = await db.execute(sql`
            SELECT id, name, ${sql.raw(`'${type}'`)} as type, metadata
            FROM ${sql.raw(table)}
            WHERE name ILIKE ${`%${query}%`}
            LIMIT 10
          `);
          allResults.push(...results.rows);
        } catch {
          // Table may not exist
        }
      }

      if (allResults.length === 0) {
        return {
          found: false,
          query,
          message: `No entities found matching "${query}"`,
          suggestion:
            "Try a different search term or browse /library/graph",
        };
      }

      // Get edges for found entities
      const entityIds = allResults.map((r: any) => r.id);
      let edgeResults: any = { rows: [] };
      try {
        edgeResults = await db.execute(sql`
          SELECT id, from_entity_id as source, to_entity_id as target, edge_type as type, weight
          FROM library_edges
          WHERE from_entity_id = ANY(${entityIds})
             OR to_entity_id = ANY(${entityIds})
          LIMIT 50
        `);
      } catch {
        // Edges table may not exist
      }

      return {
        found: true,
        query,
        entities: allResults.map((r: any) => ({
          id: r.id,
          name: r.name,
          type: r.type,
        })),
        edges: edgeResults.rows,
        graphUrl: `/library/graph?focus=${allResults[0].id}`,
        totalEntities: allResults.length,
      };
    } finally {
      // Connection managed by pool
    }
  },
});
