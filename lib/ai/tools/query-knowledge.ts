/**
 * U7.4: query_knowledge — 8th Gatekeeper Tool (Pattern A+2)
 *
 * The foundational anti-guesswork tool. Queries the Postgres KG for:
 * - Entities matching NL query (vector similarity + text search)
 * - Graph traversal (recursive CTE, depth 1-3)
 * - Cardinal rules (top-priority, confidence=1.0)
 * - Recent lessons learned
 * - Recommended skills based on query context
 *
 * Cardinal rule: query_knowledge SHOULD be called before executing any routine.
 */

import { tool } from "ai";
import { z } from "zod";
import {
  searchEntities,
  vectorSearch,
  traverseGraph,
  listEntitiesByType,
  getKgStats,
} from "@/lib/knowledge/client";
import { generateEmbedding } from "@/lib/knowledge/embeddings";
import { ENTITY_TYPES } from "@/lib/knowledge/types";
import type { KnowledgeResult, SessionRef } from "@/lib/knowledge/types";

export const queryKnowledge = tool({
  description: `Query the Knowledge Graph to find what Neptune already knows. Use this BEFORE executing any routine to avoid repeating past mistakes.

The KG stores: Connector behaviors, Skill workflows, Domain patterns, Cardinal rules, Lessons learned from past sessions, and more.

Best used for:
- "how do we..." → check existing workflows
- "what do we know about..." → find facts and patterns
- "verify..." → check if something is correct
- "is this still right" → find recent lessons that may have invalidated old knowledge
- Before executing any billing, support, or deployment routine`,

  inputSchema: z.object({
    query: z.string().describe("Natural language query about what you want to know"),
    scope: z
      .array(
        z.enum(ENTITY_TYPES)
      )
      .optional()
      .describe("Filter to specific entity types (e.g. ['Pattern', 'Cardinal', 'Lesson'])"),
    depth: z
      .number()
      .min(1)
      .max(3)
      .default(2)
      .describe("Graph traversal depth for related entities (1-3)"),
    limit: z.number().min(1).max(50).default(20).describe("Max results to return"),
  }),

  execute: async ({ query, scope, depth, limit }): Promise<KnowledgeResult> => {
    const result: KnowledgeResult = {
      entities: [],
      relations: [],
      lessons: [],
      cardinals: [],
      source_logs: [],
      recommended_skills: [],
    };

    try {
      // 1. Vector similarity search
      const embedding = await generateEmbedding(query);
      const similarEntities = await vectorSearch(embedding, limit, 0.3);

      // 2. Text-based search (fallback/complement)
      const textMatches = await searchEntities(query, limit);

      // 3. Merge and deduplicate entities
      const entityMap = new Map<string, typeof similarEntities[0]>();
      for (const e of similarEntities) entityMap.set(e.id, e);
      for (const e of textMatches) {
        if (!entityMap.has(e.id)) entityMap.set(e.id, { ...e, similarity: 0.5 });
      }

      let entities = Array.from(entityMap.values());

      // 4. Apply scope filter if specified
      if (scope && scope.length > 0) {
        entities = entities.filter((e) => scope.includes(e.type as (typeof ENTITY_TYPES)[number]));
      }

      // Sort by confidence * similarity
      entities.sort((a, b) => {
        const scoreA = a.confidence * (a.similarity ?? 0.5);
        const scoreB = b.confidence * (b.similarity ?? 0.5);
        return scoreB - scoreA;
      });

      result.entities = entities.slice(0, limit) as KnowledgeResult["entities"];

      // 5. Separate cards and lessons
      result.cardinals = result.entities.filter((e) => e.type === "Cardinal");
      result.lessons = result.entities.filter((e) => e.type === "Lesson");

      // 6. Graph traversal for top entity
      if (result.entities.length > 0 && depth > 1) {
        try {
          const graph = await traverseGraph(result.entities[0].id, depth as 1 | 2 | 3);
          // Add relations not already present
          const existingRelIds = new Set(result.relations.map((r) => r.id));
          for (const rel of graph.relations) {
            if (!existingRelIds.has(rel.id)) {
              result.relations.push(rel);
            }
          }
          // Add entities not already present
          const existingEntityIds = new Set(result.entities.map((e) => e.id));
          for (const entity of graph.entities) {
            if (!existingEntityIds.has(entity.id)) {
              result.entities.push(entity);
              if (entity.type === "Lesson") result.lessons.push(entity);
              if (entity.type === "Cardinal") result.cardinals.push(entity);
            }
          }
        } catch {
          // Graph traversal is best-effort
        }
      }

      // 7. Get recent source sessions
      const sessionSet = new Set<string>();
      for (const e of result.entities) {
        const prov = e.provenance as { sessionId?: string } | null;
        if (prov?.sessionId) sessionSet.add(prov.sessionId);
      }
      result.source_logs = Array.from(sessionSet).map((sid) => ({
        sessionId: sid,
        turnCount: 1,
        timestamp: "",
      }));

      // 8. Recommend skills based on found entities
      const skillNames = new Set<string>();
      for (const e of result.entities) {
        if (e.type === "Skill" || e.type === "Pattern") {
          skillNames.add(e.name);
        }
      }
      result.recommended_skills = Array.from(skillNames).slice(0, 5);

      return result;
    } catch (err) {
      console.error("[query_knowledge] Error:", (err as Error).message);
      return result; // Return partial results on error
    }
  },
});

export { ENTITY_TYPES };
