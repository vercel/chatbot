/**
 * lib/knowledge/backfill-graph-tags.ts
 *
 * Reads all GRAPH-TAG.json files from connectors and playbooks directories
 * and upserts entities and relations into the Knowledge Graph's
 * library_entities and library_relations tables.
 *
 * Designed to run via POST /api/knowledge/backfill or scheduled cron.
 */

import { readFileSync, existsSync } from "fs";
import { readdirSync } from "fs";
import { join } from "path";
import type {
  EntityInsert,
  RelationInsert,
  EntityType,
  RelationType,
} from "./types";
import { getKgSql } from "./client";

interface GraphTag {
  entity_type: string;
  entity_id: string;
  version: string;
  graph_version: string;
  directions: {
    associated_playbooks?: { ref: string; relationship: string }[];
    associated_skills?: { ref: string; relationship: string }[];
    exposed_functions?: string[];
    runtime_types?: string[];
    intent_tags?: string[];
  };
  metadata: {
    domain?: string;
    mcp?: boolean;
    custom_client?: boolean;
    function_count?: number;
    description?: string;
  };
}

interface BackfillResult {
  success: boolean;
  entitiesCreated: number;
  entitiesUpdated: number;
  relationsCreated: number;
  relationsUpdated: number;
  connectorsProcessed: number;
  playbooksProcessed: number;
  errors: string[];
  processedAt: string;
}

/**
 * Read and parse a GRAPH-TAG.json file.
 */
function readGraphTag(path: string): GraphTag | null {
  try {
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    // Guard: skip files missing the required entity_id field
    if (!parsed.entity_id) return null;
    return parsed as GraphTag;
  } catch {
    return null;
  }
}

/**
 * Discover all GRAPH-TAG.json files in connectors/ and playbooks/.
 */
function discoverGraphTags(): { path: string; tag: GraphTag; kind: "connector" | "playbook" }[] {
  const results: { path: string; tag: GraphTag; kind: "connector" | "playbook" }[] = [];

  // Scan connectors/
  const connectorsDir = join(process.cwd(), "connectors");
  if (existsSync(connectorsDir)) {
    for (const entry of readdirSync(connectorsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const tagPath = join(connectorsDir, entry.name, "GRAPH-TAG.json");
        const tag = readGraphTag(tagPath);
        if (tag) {
          results.push({ path: tagPath, tag, kind: "connector" });
        }
      }
    }
  }

  // Scan playbooks/
  const playbooksDir = join(process.cwd(), "playbooks");
  if (existsSync(playbooksDir)) {
    for (const entry of readdirSync(playbooksDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const tagPath = join(playbooksDir, entry.name, "GRAPH-TAG.json");
        const tag = readGraphTag(tagPath);
        if (tag) {
          results.push({ path: tagPath, tag, kind: "playbook" });
        }
      }
    }
  }

  return results;
}

/**
 * Upsert a single entity into kg_entities.
 * Uses ON CONFLICT (type, name) DO UPDATE to avoid duplicates.
 */
async function upsertEntity(
  sql: ReturnType<typeof getKgSql>,
  entity: EntityInsert
): Promise<"created" | "updated"> {
  const result = await sql`
    INSERT INTO kg_entities (type, name, description, properties, confidence)
    VALUES (
      ${entity.type},
      ${entity.name},
      ${entity.description || null},
      ${sql.json(entity.properties || {})},
      ${entity.confidence || 1.0}
    )
    ON CONFLICT (type, name)
    DO UPDATE SET
      description = EXCLUDED.description,
      properties = EXCLUDED.properties,
      confidence = EXCLUDED.confidence,
      updated_at = now()
    RETURNING id
  `;

  return result.length > 0 && result[0]?.id ? "created" : "updated";
}

/**
 * Upsert a relation between two entities.
 */
async function upsertRelation(
  sql: ReturnType<typeof getKgSql>,
  relation: RelationInsert
): Promise<"created" | "updated"> {
  const result = await sql`
    INSERT INTO kg_relations (from_entity_id, to_entity_id, type, properties, confidence)
    VALUES (
      ${relation.from_entity_id},
      ${relation.to_entity_id},
      ${relation.type},
      ${sql.json(relation.properties || {})},
      ${relation.confidence || 1.0}
    )
    ON CONFLICT (from_entity_id, to_entity_id, type)
    DO UPDATE SET
      properties = EXCLUDED.properties,
      confidence = EXCLUDED.confidence,
      updated_at = NOW()
    RETURNING id
  `;

  return result.length > 0 && result[0]?.id ? "created" : "updated";
}

/**
 * Main backfill function.
 * Reads all GRAPH-TAG.json files and upserts into the KG.
 */
export async function backfillGraphTags(): Promise<BackfillResult> {
  const result: BackfillResult = {
    success: false,
    entitiesCreated: 0,
    entitiesUpdated: 0,
    relationsCreated: 0,
    relationsUpdated: 0,
    connectorsProcessed: 0,
    playbooksProcessed: 0,
    errors: [],
    processedAt: new Date().toISOString(),
  };

  try {
    const sql = getKgSql();
    const tags = discoverGraphTags();

    // Track entity IDs for relation creation
    const entityIdMap = new Map<string, string>();

    for (const { path, tag, kind } of tags) {
      try {
        // ── Upsert connector/playbook entity ──
        const entityType: EntityType = kind === "connector" ? "Connector" : "Domain";
        const entityName = tag.entity_id.replace(/^connectors\//, "").replace(/^playbooks\//, "");

        const entityInsert: EntityInsert = {
          type: entityType,
          name: tag.entity_id,
          description: tag.metadata?.description || `${entityName} ${kind}`,
          properties: {
            graph_version: tag.graph_version,
            version: tag.version,
            domain: tag.metadata?.domain,
            mcp: tag.metadata?.mcp,
            function_count: tag.metadata?.function_count,
            runtime_types: tag.directions?.runtime_types,
            intent_tags: tag.directions?.intent_tags,
            exposed_functions: tag.directions?.exposed_functions,
          },
          path,
          confidence: 1.0,
        };

        const entityStatus = await upsertEntity(sql, entityInsert);
        if (entityStatus === "created") result.entitiesCreated++;
        else result.entitiesUpdated++;

        // Look up the entity ID
        const entityRow = await sql<{ id: string }[]>`
          SELECT id FROM kg_entities WHERE type = ${entityType} AND name = ${tag.entity_id} LIMIT 1
        `;
        if (entityRow.length > 0) {
          entityIdMap.set(tag.entity_id, entityRow[0].id);
        }

        if (kind === "connector") result.connectorsProcessed++;
        else result.playbooksProcessed++;

        // ── Create relations to associated playbooks ──
        if (tag.directions?.associated_playbooks) {
          for (const playbook of tag.directions.associated_playbooks) {
            const playbookEntityRow = await sql<{ id: string }[]>`
              SELECT id FROM kg_entities WHERE name = ${playbook.ref} LIMIT 1
            `;
            const fromId = entityIdMap.get(tag.entity_id);
            const toId = playbookEntityRow[0]?.id;
            if (fromId && toId) {
              const relStatus = await upsertRelation(sql, {
                from_entity_id: fromId,
                to_entity_id: toId,
                type: playbook.relationship.toUpperCase().replace(/\s+/g, "_") as RelationType,
                properties: { source: "GRAPH-TAG", relationship: playbook.relationship },
              });
              if (relStatus === "created") result.relationsCreated++;
              else result.relationsUpdated++;
            }
          }
        }

        // ── Create relations to associated skills ──
        if (tag.directions?.associated_skills) {
          for (const skill of tag.directions.associated_skills) {
            const skillEntityRow = await sql<{ id: string }[]>`
              SELECT id FROM kg_entities WHERE name LIKE ${"%" + skill.ref} LIMIT 1
            `;
            const fromId = entityIdMap.get(tag.entity_id);
            const toId = skillEntityRow[0]?.id;
            if (fromId && toId) {
              const relStatus = await upsertRelation(sql, {
                from_entity_id: fromId,
                to_entity_id: toId,
                type: "USES" as RelationType,
                properties: { source: "GRAPH-TAG", relationship: skill.relationship },
              });
              if (relStatus === "created") result.relationsCreated++;
              else result.relationsUpdated++;
            }
          }
        }
      } catch (err) {
        result.errors.push(
          `Failed to process ${kind} ${tag.entity_id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    result.success = result.errors.length === 0;
  } catch (err) {
    result.errors.push(
      `Backfill failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return result;
}

export { getKgSql };

// Export for direct invocation
export default backfillGraphTags;
