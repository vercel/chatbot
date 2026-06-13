/**
 * U7.1: Knowledge Graph Client — Singleton Postgres connection for KG operations.
 *
 * Uses the same POSTGRES_URL as the rest of the app (shared Vercel Postgres).
 * Provides typed query methods for entities, relations, and graph traversal.
 */

import postgres from "postgres";
import type {
  EntityInsert,
  EntityType,
  KgEntity,
  KgRelation,
  KnowledgeResult,
  RelationInsert,
  RelationType,
} from "./types";

// ── Singleton ─────────────────────────────────────────────────────────────

let _kgSql: ReturnType<typeof postgres> | null = null;
let _initError: Error | null = null;

function getKgSql(): ReturnType<typeof postgres> {
  if (_initError) throw _initError;
  if (!_kgSql) {
    const url = process.env.POSTGRES_URL;
    if (!url) {
      _initError = new Error(
        "POSTGRES_URL not set — KG client cannot initialize"
      );
      throw _initError;
    }
    _kgSql = postgres(url, {
      max: 5,
      idle_timeout: 30,
      connect_timeout: 10,
    });
  }
  return _kgSql;
}

// ── Health Check ──────────────────────────────────────────────────────────

export async function kgHealthCheck(): Promise<{
  ok: boolean;
  extensions: string[];
  error?: string;
}> {
  try {
    const sql = getKgSql();
    const rows = await sql<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname IN ('vector', 'ltree')
    `;
    return {
      ok: true,
      extensions: rows.map((r) => r.extname),
    };
  } catch (err) {
    return {
      ok: false,
      extensions: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Entity CRUD ───────────────────────────────────────────────────────────

export async function upsertEntity(
  entity: EntityInsert
): Promise<KgEntity> {
  const sql = getKgSql();
  const vectorLiteral = entity.embedding
    ? `[${entity.embedding.join(",")}]`
    : null;

  const rows = await sql<KgEntity[]>`
    INSERT INTO kg_entities (
      type, name, description, properties, embedding, path, confidence, provenance
    ) VALUES (
      ${entity.type},
      ${entity.name},
      ${entity.description ?? null},
      ${sql.json((entity.properties ?? {}) as Record<string, any>)},
      ${vectorLiteral ? sql.unsafe(`'${vectorLiteral}'::vector`) : null},
      ${entity.path ?? null}::ltree,
      ${entity.confidence ?? 1.0},
      ${entity.provenance ? sql.json(entity.provenance as Record<string, any>) : null}
    )
    ON CONFLICT (type, name)
    DO UPDATE SET
      description = COALESCE(EXCLUDED.description, kg_entities.description),
      properties = COALESCE(EXCLUDED.properties, kg_entities.properties),
      embedding = COALESCE(EXCLUDED.embedding, kg_entities.embedding),
      path = COALESCE(EXCLUDED.path, kg_entities.path),
      confidence = EXCLUDED.confidence,
      provenance = COALESCE(EXCLUDED.provenance, kg_entities.provenance),
      updated_at = now()
    RETURNING *
  `;
  return rows[0];
}

export async function getEntityById(id: string): Promise<KgEntity | null> {
  const sql = getKgSql();
  const rows = await sql<KgEntity[]>`
    SELECT * FROM kg_entities WHERE id = ${id}
  `;
  return rows[0] ?? null;
}

export async function getEntityByTypeAndName(
  type: EntityType,
  name: string
): Promise<KgEntity | null> {
  const sql = getKgSql();
  const rows = await sql<KgEntity[]>`
    SELECT * FROM kg_entities WHERE type = ${type} AND name = ${name}
  `;
  return rows[0] ?? null;
}

export async function listEntitiesByType(
  type: EntityType,
  limit = 50
): Promise<KgEntity[]> {
  const sql = getKgSql();
  return sql<KgEntity[]>`
    SELECT * FROM kg_entities
    WHERE type = ${type}
    ORDER BY confidence DESC, updated_at DESC
    LIMIT ${limit}
  `;
}

export async function searchEntities(
  query: string,
  limit = 20
): Promise<KgEntity[]> {
  const sql = getKgSql();
  return sql<KgEntity[]>`
    SELECT * FROM kg_entities
    WHERE name ILIKE ${"%" + query + "%"}
       OR description ILIKE ${"%" + query + "%"}
    ORDER BY confidence DESC
    LIMIT ${limit}
  `;
}

// ── Vector Similarity Search ──────────────────────────────────────────────

export async function vectorSearch(
  embedding: number[],
  limit = 20,
  threshold = 0.5
): Promise<(KgEntity & { similarity: number })[]> {
  const sql = getKgSql();
  const vectorStr = `[${embedding.join(",")}]`;
  return sql.unsafe(`
    SELECT *, 1 - (embedding <=> '${vectorStr}'::vector) AS similarity
    FROM kg_entities
    WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> '${vectorStr}'::vector) > ${threshold}
    ORDER BY embedding <=> '${vectorStr}'::vector
    LIMIT ${limit}
  `) as unknown as Promise<(KgEntity & { similarity: number })[]>;
}

// ── Relation CRUD ─────────────────────────────────────────────────────────

export async function upsertRelation(
  rel: RelationInsert
): Promise<KgRelation> {
  const sql = getKgSql();
  const rows = await sql<KgRelation[]>`
    INSERT INTO kg_relations (
      from_entity_id, to_entity_id, type, properties, confidence, provenance
    ) VALUES (
      ${rel.from_entity_id},
      ${rel.to_entity_id},
      ${rel.type},
      ${sql.json((rel.properties ?? {}) as Record<string, any>)},
      ${rel.confidence ?? 1.0},
      ${rel.provenance ? sql.json(rel.provenance as Record<string, any>) : null}
    )
    ON CONFLICT (from_entity_id, to_entity_id, type)
    DO UPDATE SET
      properties = COALESCE(EXCLUDED.properties, kg_relations.properties),
      confidence = EXCLUDED.confidence,
      provenance = COALESCE(EXCLUDED.provenance, kg_relations.provenance)
    RETURNING *
  `;
  return rows[0];
}

export async function getRelationsForEntity(
  entityId: string,
  direction: "from" | "to" | "both" = "both",
  limit = 50
): Promise<KgRelation[]> {
  const sql = getKgSql();
  if (direction === "from") {
    return sql<KgRelation[]>`
      SELECT * FROM kg_relations WHERE from_entity_id = ${entityId} LIMIT ${limit}
    `;
  }
  if (direction === "to") {
    return sql<KgRelation[]>`
      SELECT * FROM kg_relations WHERE to_entity_id = ${entityId} LIMIT ${limit}
    `;
  }
  return sql<KgRelation[]>`
    SELECT * FROM kg_relations
    WHERE from_entity_id = ${entityId} OR to_entity_id = ${entityId}
    LIMIT ${limit}
  `;
}

// ── Graph Traversal ───────────────────────────────────────────────────────

export async function traverseGraph(
  startEntityId: string,
  depth: 1 | 2 | 3 = 2
): Promise<{ entities: KgEntity[]; relations: KgRelation[] }> {
  const sql = getKgSql();

  // Step 1: Recursive CTE to collect reachable node IDs
  const nodeRows = await sql<{ id: string; level: number }[]>`
    WITH RECURSIVE graph_walk AS (
      SELECT id, 0::int AS level
      FROM kg_entities
      WHERE id = ${startEntityId}

      UNION

      SELECT
        CASE WHEN r.from_entity_id = gw.id THEN r.to_entity_id ELSE r.from_entity_id END AS id,
        gw.level + 1 AS level
      FROM kg_relations r
      JOIN graph_walk gw ON (r.from_entity_id = gw.id OR r.to_entity_id = gw.id)
      WHERE gw.level < ${depth}
    )
    SELECT DISTINCT id, level FROM graph_walk
  `;
  const nodeIds = Array.from(new Set(nodeRows.map((r) => r.id)));

  // Step 2: Fetch all entities
  const entities = nodeIds.length > 0
    ? await sql<KgEntity[]>`
        SELECT * FROM kg_entities WHERE id IN ${sql(nodeIds)}
      `
    : [];

  // Step 3: Fetch all relations between these nodes
  const relations = nodeIds.length > 1
    ? await sql<KgRelation[]>`
        SELECT * FROM kg_relations
        WHERE from_entity_id IN ${sql(nodeIds)}
          AND to_entity_id IN ${sql(nodeIds)}
      `
    : [];

  return { entities, relations };
}

// ── Counts ────────────────────────────────────────────────────────────────

export async function getKgStats(): Promise<{
  entityCount: number;
  relationCount: number;
  entityTypes: Record<string, number>;
}> {
  const sql = getKgSql();
  const [counts] = await sql<[{ entity_count: string; relation_count: string }]>`
    SELECT
      (SELECT COUNT(*) FROM kg_entities) AS entity_count,
      (SELECT COUNT(*) FROM kg_relations) AS relation_count
  `;
  const typeBreakdown = await sql<{ type: string; count: string }[]>`
    SELECT type, COUNT(*)::text AS count
    FROM kg_entities
    GROUP BY type
    ORDER BY count DESC
  `;
  const entityTypes: Record<string, number> = {};
  for (const row of typeBreakdown) {
    entityTypes[row.type] = parseInt(row.count, 10);
  }
  return {
    entityCount: parseInt(counts.entity_count, 10),
    relationCount: parseInt(counts.relation_count, 10),
    entityTypes,
  };
}
